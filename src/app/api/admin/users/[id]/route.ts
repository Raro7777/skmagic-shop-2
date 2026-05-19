import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateTempPassword, BCRYPT_COST } from "@/lib/passwordPolicy";
import { sendCredentialEmail } from "@/lib/notifier";
import { writeAudit, extractRequestInfo } from "@/lib/auditLog";
import bcrypt from "bcryptjs";

function loginUrl(req: Request): string {
  try {
    return new URL("/login", req.url).toString();
  } catch {
    return "/login";
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/users/[id] — HQ 전용
//   action: "unlock" | "resetPassword" | "setStatus"
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ action: "unlock" | "resetPassword" | "setStatus"; status: "active" | "disabled" }>;
  if (!b.action) return NextResponse.json({ error: "action 필수" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { ip, userAgent } = extractRequestInfo(req);
  const actor = { actorId: session.user.id, actorEmail: session.user.email, ip, userAgent };

  if (b.action === "unlock") {
    if (!target.lockedUntil && target.failedLoginAttempts === 0) {
      return NextResponse.json({ error: "이미 잠금 해제 상태입니다." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
    });
    await writeAudit({ ...actor, action: "account_unlock", targetUserId: target.id, targetEmail: target.email });
    return NextResponse.json({ ok: true, message: `${target.email} 계정의 잠금이 해제되었습니다.` });
  }

  if (b.action === "resetPassword") {
    if (target.id === session.user.id) {
      return NextResponse.json({ error: "본인 계정은 '내 계정' 페이지에서 비밀번호를 변경하세요." }, { status: 400 });
    }
    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, BCRYPT_COST);
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: hash,
        mustChangePassword: true,         // 임시 비번 → 다음 로그인 시 강제 변경
        lockedUntil: null,
        failedLoginAttempts: 0,
      },
    });

    // 사용자 이메일로 발송 + Outbox 적재 (본사가 요청 시 안내 가능)
    let mailResult: { ok: boolean; provider?: string; error?: string } = { ok: false, error: "" };
    try {
      mailResult = await sendCredentialEmail({
        to: target.email,
        name: target.name,
        tempPassword,
        role: target.role as "hq" | "partner_admin" | "seller",
        loginUrl: loginUrl(req),
        isReset: true,
      });
    } catch (e) {
      mailResult = { ok: false, error: e instanceof Error ? e.message : "email send failed" };
    }

    await writeAudit({
      ...actor,
      action: "password_reset",
      targetUserId: target.id, targetEmail: target.email,
      metadata: { mailDelivered: mailResult.ok, mailProvider: mailResult.provider ?? null },
    });

    return NextResponse.json({
      ok: true,
      tempPassword,                       // ⚠ 1회만 노출. 프론트에서 사용자 안내 후 즉시 폐기.
      mailDelivered: mailResult.ok,
      mailProvider: mailResult.ok ? mailResult.provider : null,
      mailError: mailResult.ok ? null : mailResult.error,
      message: `${target.email} 임시 비밀번호가 발급되었습니다. 사용자 이메일로 자동 발송됐고, 본사 콘솔에서도 즉시 안내할 수 있도록 1회 노출됩니다.`,
    });
  }

  if (b.action === "setStatus") {
    if (!b.status || !["active", "disabled"].includes(b.status)) {
      return NextResponse.json({ error: "status는 active 또는 disabled여야 합니다." }, { status: 400 });
    }
    if (target.id === session.user.id && b.status === "disabled") {
      return NextResponse.json({ error: "본인 계정을 비활성화할 수 없습니다." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id },
      data: { status: b.status },
    });
    await writeAudit({
      ...actor,
      action: "account_status_change",
      targetUserId: target.id, targetEmail: target.email,
      metadata: { from: target.status, to: b.status },
    });
    return NextResponse.json({ ok: true, message: `${target.email} 상태: ${b.status}` });
  }

  return NextResponse.json({ error: "유효하지 않은 action" }, { status: 400 });
}
