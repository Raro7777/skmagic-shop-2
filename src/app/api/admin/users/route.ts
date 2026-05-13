import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateTempPassword } from "@/lib/passwordPolicy";
import { sendCredentialEmail } from "@/lib/notifier";
import { writeAudit, extractRequestInfo } from "@/lib/auditLog";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/users — HQ 전용 사용자 목록
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const role = url.searchParams.get("role");

  const users = await prisma.user.findMany({
    where: {
      ...(q && {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(role && ["hq", "partner_admin", "seller"].includes(role) && { role }),
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    take: 200,
    select: {
      id: true, email: true, name: true, role: true, partnerId: true, status: true,
      failedLoginAttempts: true, lockedUntil: true, lastLoginAt: true, createdAt: true,
      partner: { select: { partnerName: true } },
      seller: { select: { sellerCode: true } },
    },
  });

  const now = new Date();
  return NextResponse.json({
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      partnerId: u.partnerId,
      partnerName: u.partner?.partnerName ?? null,
      sellerCode: u.seller?.sellerCode ?? null,
      status: u.status,
      failedLoginAttempts: u.failedLoginAttempts,
      isLocked: !!(u.lockedUntil && u.lockedUntil > now),
      lockedUntil: u.lockedUntil?.toISOString() ?? null,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}

// POST /api/admin/users — HQ 전용. 신규 사용자 생성 + 임시 비번 발급 + 이메일 발송.
//   body: { email, name, role: "hq"|"partner_admin"|"seller", partnerId? }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{
    email: string;
    name: string;
    role: "hq" | "partner_admin" | "seller";
    partnerId: string | null;
  }>;

  // 검증
  const email = b.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "유효한 이메일을 입력해주세요." }, { status: 400 });
  }
  const role = b.role;
  if (role !== "hq" && role !== "partner_admin" && role !== "seller") {
    return NextResponse.json({ error: "role 은 hq / partner_admin / seller 중 하나" }, { status: 400 });
  }
  const partnerId = b.partnerId?.trim() || null;
  if ((role === "partner_admin" || role === "seller") && !partnerId) {
    return NextResponse.json({ error: "협력점/영업자는 partnerId 필수" }, { status: 400 });
  }
  if (role === "hq" && partnerId) {
    return NextResponse.json({ error: "본사 계정은 partnerId 없이 발급" }, { status: 400 });
  }

  // 중복 이메일 검사
  const dup = await prisma.user.findUnique({ where: { email } });
  if (dup) return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });

  // 협력점 존재 확인
  if (partnerId) {
    const p = await prisma.partner.findUnique({ where: { partnerCode: partnerId } });
    if (!p) return NextResponse.json({ error: "Partner not found: " + partnerId }, { status: 404 });
  }

  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name: b.name?.trim().slice(0, 40) || null,
      passwordHash: hash,
      role,
      partnerId,
      mustChangePassword: true, // 첫 로그인 강제 변경
    },
    select: { id: true, email: true, name: true, role: true },
  });

  // 이메일 발송 + Outbox
  let mailDelivered = false;
  let mailProvider: string | null = null;
  try {
    const r = await sendCredentialEmail({
      to: user.email,
      name: user.name,
      tempPassword,
      role,
      loginUrl: new URL("/login", req.url).toString(),
      isReset: false,
    });
    mailDelivered = true;
    mailProvider = r.provider;
  } catch { /* outbox 에 적재되었으므로 worker 가 retry */ }

  const { ip, userAgent } = extractRequestInfo(req);
  await writeAudit({
    action: "account_create",
    actorId: session.user.id, actorEmail: session.user.email,
    targetUserId: user.id, targetEmail: user.email,
    ip, userAgent,
    metadata: { role: user.role, partnerId, mailDelivered },
  });

  return NextResponse.json({
    ok: true,
    user,
    tempPassword,   // ⚠ 1회만 노출.
    mailDelivered,
    mailProvider,
    message: `${user.email} 계정이 발급되었습니다. 임시 비밀번호는 사용자 이메일로 발송됐고, 본사 콘솔에서도 1회 노출됩니다.`,
  });
}
