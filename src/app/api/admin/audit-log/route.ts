/**
 * GET /api/admin/audit-log — 본사 전용. 감사 로그 조회.
 *   ?action=login_fail&actor=...&target=...&days=7&limit=200
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = [
  "login_success", "login_fail", "login_locked",
  "account_create", "password_change", "password_reset",
  "account_unlock", "account_status_change", "session_logout",
] as const;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action")?.trim() || null;
  const actor = url.searchParams.get("actor")?.trim() || null;
  const target = url.searchParams.get("target")?.trim() || null;
  const daysRaw = url.searchParams.get("days");
  const days = daysRaw ? Math.max(1, Math.min(90, Number(daysRaw))) : 30;
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? "200")));

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: Parameters<typeof prisma.auditLog.findMany>[0] = {
    where: {
      createdAt: { gte: since },
      ...(action && (ACTIONS as readonly string[]).includes(action) ? { action } : {}),
      ...(actor ? {
        OR: [
          { actorEmail: { contains: actor, mode: "insensitive" } },
          { actorId: actor },
        ],
      } : {}),
      ...(target ? {
        OR: [
          { targetEmail: { contains: target, mode: "insensitive" } },
          { targetUserId: target },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  };

  const rows = await prisma.auditLog.findMany(where);

  // 액션별 카운트 (요약)
  const counts = await prisma.auditLog.groupBy({
    by: ["action"],
    where: { createdAt: { gte: since } },
    _count: true,
  });

  return NextResponse.json({
    rows: rows.map(r => ({
      id: r.id,
      action: r.action,
      actorEmail: r.actorEmail,
      actorId: r.actorId,
      targetEmail: r.targetEmail,
      targetUserId: r.targetUserId,
      ip: r.ip,
      userAgent: r.userAgent,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    })),
    counts: Object.fromEntries(counts.map(c => [c.action, c._count])),
    sinceDays: days,
  });
}
