import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/passwordPolicy";
import { writeAudit, extractRequestInfo } from "@/lib/auditLog";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH — 본인 비밀번호 변경 (현재 비번 + 새 비번)
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ currentPassword: string; newPassword: string }>;
  if (!b.currentPassword || !b.newPassword) {
    return NextResponse.json({ error: "현재 비밀번호와 새 비밀번호 모두 필요합니다." }, { status: 400 });
  }
  if (b.currentPassword === b.newPassword) {
    return NextResponse.json({ error: "새 비밀번호가 현재 비밀번호와 동일합니다." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, passwordHash: true, status: true },
  });
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "계정 상태가 비정상입니다." }, { status: 403 });
  }

  const policy = validatePassword(b.newPassword, { email: user.email });
  if (!policy.ok) {
    return NextResponse.json({ error: policy.reason, issues: policy.messages }, { status: 400 });
  }

  const ok = await bcrypt.compare(b.currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "현재 비밀번호가 일치하지 않습니다." }, { status: 400 });
  }

  const newHash = await bcrypt.hash(b.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
      passwordUpdatedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const { ip, userAgent } = extractRequestInfo(req);
  await writeAudit({
    action: "password_change",
    actorId: user.id, actorEmail: user.email,
    ip, userAgent,
  });

  return NextResponse.json({ ok: true, message: "비밀번호가 변경되었습니다." });
}
