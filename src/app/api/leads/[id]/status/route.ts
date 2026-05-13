import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLeadById, updateLeadStatus } from "@/lib/leadStore";
import { LEAD_STATUSES, canTransition, type LeadStatus, type ActorRole } from "@/lib/leadStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set<string>(LEAD_STATUSES);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Partial<{ status: LeadStatus; memo: string; reason: string }>;
  if (!b.status || !ALLOWED.has(b.status)) {
    return NextResponse.json(
      { error: `유효하지 않은 status (허용: ${LEAD_STATUSES.join(" | ")})` },
      { status: 400 }
    );
  }

  // Permission check — partner_admin / seller은 자기 소속 lead만
  const lead = await getLeadById(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const role = session.user.role as string;
  // ActorRole 매핑 — 그 외 역할은 거부
  let actorRole: ActorRole;
  if (role === "hq") actorRole = "hq";
  else if (role === "partner_admin") actorRole = "partner_admin";
  else if (role === "seller") actorRole = "seller";
  else return NextResponse.json({ error: "Forbidden — 알 수 없는 역할" }, { status: 403 });

  if (actorRole === "partner_admin" && lead.partnerId !== session.user.partnerId) {
    return NextResponse.json({ error: "Forbidden — 본인 점 lead가 아닙니다." }, { status: 403 });
  }
  if (actorRole === "seller") {
    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!seller || lead.sellerId !== seller.id) {
      return NextResponse.json({ error: "Forbidden — 본인이 받은 lead만 수정 가능합니다." }, { status: 403 });
    }
  }

  // 역할 매트릭스 사전 검증 (본사는 bypass) — 권한 부재면 403, 그 외 도메인 에러는 leadStore 가 400
  if (actorRole !== "hq" && !canTransition(lead.status as LeadStatus, b.status, actorRole)) {
    return NextResponse.json(
      { error: `Forbidden — ${actorRole} 권한으로는 ${lead.status} → ${b.status} 전이 불가합니다.` },
      { status: 403 }
    );
  }

  const result = await updateLeadStatus({
    leadId: id,
    newStatus: b.status,
    actorRole,
    changedById: session.user.id,
    memo: b.memo,
    reason: b.reason,
    bypassStateMachine: actorRole === "hq",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    lead: { id: result.lead.id, status: result.lead.status },
    logs: result.logs,
  });
}
