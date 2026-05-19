import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { maskRRN, maskAccount, maskCardNumber } from "@/lib/enrollmentForm";
import type { ActorRole } from "@/lib/leadStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * P0-5: changes JSON 의 PII 필드를 actorRole 기준으로 마스킹.
 * viewForRole 과 동일한 정책 — hq/partner_admin 평문, seller 는 본인 작성 건만 평문.
 */
type ChangeMap = Record<string, { from: unknown; to: unknown }>;
const PII_FIELD_HANDLERS: Record<string, (v: string, role: ActorRole, isOwn: boolean) => string> = {
  residentRegNumber: maskRRN,
  autoDebitAccount:  maskAccount,
  cardNumber:        maskCardNumber,
  giftAccount:       maskAccount,
};
function maskChanges(changes: unknown, actorRole: ActorRole, isOwn: boolean): unknown {
  if (!changes || typeof changes !== "object") return changes;
  const out: ChangeMap = {};
  for (const [k, v] of Object.entries(changes as ChangeMap)) {
    const mask = PII_FIELD_HANDLERS[k];
    if (mask) {
      out[k] = {
        from: typeof v.from === "string" && v.from ? mask(v.from, actorRole, isOwn) : v.from,
        to:   typeof v.to   === "string" && v.to   ? mask(v.to,   actorRole, isOwn) : v.to,
      };
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** GET — 특정 lead 의 EnrollmentForm 변경 이력 (timeline) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!["hq", "partner_admin", "seller"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  // 권한 게이트 — 협력점/영업자는 자기 lead 만
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { partnerId: true, sellerId: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (role === "partner_admin" && lead.partnerId !== session.user.partnerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "seller") {
    const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller || seller.id !== lead.sellerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const rows = await prisma.enrollmentFormHistory.findMany({
    where: { leadId: id },
    orderBy: { changedAt: "desc" },
  });

  // P0-5: changes JSON 의 PII 필드를 viewForRole 과 동일 정책으로 마스킹.
  // isOwn — 해당 history 변경자(changedById)가 현재 actor 본인이면 평문 노출.
  const actorRole = role as ActorRole;
  return NextResponse.json({
    items: rows.map(r => ({
      id: r.id,
      changedAt: r.changedAt.toISOString(),
      changedById: r.changedById,
      changedByRole: r.changedByRole,
      reason: r.reason,
      changeSource: r.changeSource,
      changes: maskChanges(r.changes, actorRole, !!r.changedById && r.changedById === session.user.id),
    })),
  });
}
