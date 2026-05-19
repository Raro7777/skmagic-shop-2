import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HQ_VIEW_COOKIE, gatePartnerOrHq } from "@/lib/effectivePartner";
import { normalizeKoreanPhone } from "@/lib/sellerPhone";
import { generateSellerCode } from "@/lib/sellerCode";
import { BCRYPT_COST } from "@/lib/passwordPolicy";

/**
 * 임시 비밀번호 — 8자 base32 (혼동 방지: O/0/I/1 제외).
 * P0-3: crypto.randomInt CSPRNG 사용. Math.random 은 V8 내부 상태 복원 공격에 취약.
 */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[randomInt(0, chars.length)];
  return out;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — list sellers (partner_admin: own only, hq: all 또는 협력점 콘솔 호출 시 cookie scope)
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const partnerCodeFilter = url.searchParams.get("partnerCode");

  let where: { partnerId?: string } = {};
  if (session.user.role === "partner_admin") {
    if (!session.user.partnerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    where.partnerId = session.user.partnerId;
  } else if (session.user.role === "hq") {
    if (partnerCodeFilter) {
      where.partnerId = partnerCodeFilter;
    } else {
      const c = await cookies();
      const cookieVal = c.get(HQ_VIEW_COOKIE)?.value;
      const referer = req.headers.get("referer") ?? "";
      if (cookieVal && referer.includes("/admin/franchise")) {
        where.partnerId = cookieVal;
      }
    }
  }

  const rows = await prisma.seller.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { leads: true } },
      user: { select: { email: true } },
    },
  });

  return NextResponse.json({
    sellers: rows.map(r => ({
      id: r.id,
      sellerCode: r.sellerCode,
      partnerId: r.partnerId,
      name: r.name,
      phone: r.phone,
      email: r.email,
      loginEmail: r.user?.email ?? null,
      status: r.status,
      leadCount: r._count.leads,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

// POST — partner_admin creates a new seller in their partner (hq 협력점 콘솔 진입 시도 가능)
export async function POST(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{
    name: string;
    phone: string;
    email: string;
  }>;

  if (!b.name?.trim() || !b.phone?.trim()) {
    return NextResponse.json({ error: "이름과 전화번호는 필수입니다." }, { status: 400 });
  }
  const normalizedPhone = normalizeKoreanPhone(b.phone);
  if (!normalizedPhone) {
    return NextResponse.json(
      { error: "전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)" },
      { status: 400 }
    );
  }

  // 같은 협력점 내 같은 phone 으로 이미 등록된 활성 영업자가 있으면 사전 차단
  // (sellerCode 가 별도 자동 생성이라 phone unique constraint 가 없음)
  const dup = await prisma.seller.findFirst({
    where: { partnerId: eff.partnerId, phone: normalizedPhone, status: "active" },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: "이미 등록된 전화번호입니다." }, { status: 400 });
  }

  // sellerCode 자동 생성 (12자리 영문소문자+숫자). 충돌 시 최대 5회 재시도.
  // 동시에 영업자 로그인 User(role=seller) 도 발급 → 임시 비밀번호로 /admin/seller 로그인 가능.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateSellerCode();
    // 로그인 이메일: 신청자 제공값 우선, 없으면 sellerCode 기반 fallback.
    // 같은 이메일이 이미 점유되어 있으면 fallback 으로 회피.
    const requestedEmail = b.email?.trim().toLowerCase() || null;
    let loginEmail = requestedEmail ?? `s-${code}@rentking.kr`;
    if (requestedEmail) {
      const taken = await prisma.user.findUnique({ where: { email: requestedEmail }, select: { id: true } });
      if (taken) loginEmail = `s-${code}@rentking.kr`;
    }
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);

    try {
      const created = await prisma.$transaction(async tx => {
        const seller = await tx.seller.create({
          data: {
            partnerId: eff.partnerId,
            sellerCode: code,
            name: b.name!.trim().slice(0, 32),
            phone: normalizedPhone,
            email: b.email?.trim() || null,
            status: "active",
          },
        });
        const user = await tx.user.create({
          data: {
            email: loginEmail,
            passwordHash,
            name: b.name!.trim().slice(0, 32),
            role: "seller",
            partnerId: eff.partnerId,
            mustChangePassword: true,
            status: "active",
          },
        });
        await tx.seller.update({ where: { id: seller.id }, data: { userId: user.id } });
        return seller;
      });
      return NextResponse.json({
        ok: true,
        seller: {
          id: created.id,
          sellerCode: created.sellerCode,
          name: created.name,
          phone: created.phone,
        },
        // 협력점이 영업자에게 카톡으로 전달할 자격 — 첫 로그인 시 mustChangePassword 강제.
        login: {
          email: loginEmail,
          tempPassword,
        },
      });
    } catch (e) {
      const pcode = (e as { code?: string }).code;
      if (pcode === "P2002") continue; // sellerCode 또는 email 충돌 — 재시도
      return NextResponse.json({ error: "생성 실패" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "코드 충돌 — 잠시 후 다시 시도해주세요." }, { status: 500 });
}
