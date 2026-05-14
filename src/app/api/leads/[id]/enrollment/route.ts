import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLeadById, updateLeadStatus } from "@/lib/leadStore";
import {
  upsertEnrollmentForm,
  viewForRole,
  type EnrollmentFormInput,
} from "@/lib/enrollmentForm";
import type { ActorRole } from "@/lib/leadStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate(id: string) {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = session.user.role;
  let actorRole: ActorRole;
  if (role === "hq") actorRole = "hq";
  else if (role === "partner_admin") actorRole = "partner_admin";
  else if (role === "seller") actorRole = "seller";
  else return { err: NextResponse.json({ error: "Forbidden — 알 수 없는 역할" }, { status: 403 }) };

  const lead = await getLeadById(id);
  if (!lead) return { err: NextResponse.json({ error: "Lead not found" }, { status: 404 }) };

  // 본인 스코프 검증
  if (actorRole === "partner_admin" && lead.partnerId !== session.user.partnerId) {
    return { err: NextResponse.json({ error: "Forbidden — 본인 점 lead 가 아닙니다." }, { status: 403 }) };
  }
  if (actorRole === "seller") {
    const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller || lead.sellerId !== seller.id) {
      return { err: NextResponse.json({ error: "Forbidden — 본인이 받은 lead 만 접근 가능합니다." }, { status: 403 }) };
    }
  }

  return { actorRole, actorId: session.user.id ?? null, lead };
}

/** GET — 신청서 조회 (권한별 마스킹) + 모달 prefill 정보 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await gate(id);
  if ("err" in g) return g.err;

  const [form, leadFull] = await Promise.all([
    prisma.enrollmentForm.findUnique({ where: { leadId: id } }),
    prisma.lead.findUnique({
      where: { id },
      select: {
        customerName: true, phoneRaw: true, productCode: true, productInterest: true,
        selectedMode: true, selectedContractPeriod: true, selectedRentalPrice: true,
        rivalCompensationRequested: true, partnerId: true, selectedColor: true,
      },
    }),
  ]);

  // PartnerPolicy 에서 사은품 정보 조회 + Product.specs 에서 색상 옵션 조회 (prefill 용)
  let giftAmount = 0;
  let giftLabel: string | null = null;
  let colorOptions: string[] = [];
  if (leadFull?.partnerId && leadFull.productCode) {
    const pp = await prisma.partnerPolicy.findFirst({
      where: { partnerId: leadFull.partnerId, product: { productCode: leadFull.productCode } },
      select: { giftAmount: true, giftLabel: true },
    });
    giftAmount = pp?.giftAmount ?? 0;
    giftLabel = pp?.giftLabel ?? null;
  }
  if (leadFull?.productCode) {
    const product = await prisma.product.findUnique({
      where: { productCode: leadFull.productCode },
      select: { specs: true },
    });
    const specs = (product?.specs as Record<string, string> | null) ?? null;
    const colorStr = specs?.["색상"];
    if (colorStr) colorOptions = colorStr.split(",").map(s => s.trim()).filter(Boolean);
  }

  // 현재 lead status 도 prefill 에 포함 — 모달이 verify_failed/verify_revise 상태일 때 재제출 안내 표시.
  const currentLead = leadFull ? await prisma.lead.findUnique({ where: { id }, select: { status: true } }) : null;
  const prefill = leadFull ? {
    customerName: leadFull.customerName,
    phone: leadFull.phoneRaw,
    productCode: leadFull.productCode ?? "",
    productName: leadFull.productInterest,
    managementMode: (leadFull.selectedMode === "방문형" || leadFull.selectedMode === "셀프형") ? leadFull.selectedMode : null,
    contractPeriod: leadFull.selectedContractPeriod ?? 60,
    visitInterval: null,
    monthlyPrice: leadFull.selectedRentalPrice ?? 0,
    isRivalCompensation: leadFull.rivalCompensationRequested,
    giftAmount,
    giftLabel,
    selectedColor: leadFull.selectedColor ?? null,
    colorOptions,
    currentLeadStatus: currentLead?.status ?? null,
  } : null;

  return NextResponse.json({
    form: form ? viewForRole(form, { actorRole: g.actorRole, actorId: g.actorId }) : null,
    prefill,
  });
}

/**
 * POST — 신청서 작성 + 동시 status form_ready 전이 (autoAdvance=true 일 때).
 * 이미 존재하면 update 처리.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await gate(id);
  if ("err" in g) return g.err;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const b = body as { data?: EnrollmentFormInput; autoAdvance?: boolean; changeReason?: string; changeSource?: string };
  if (!b.data) return NextResponse.json({ error: "data 필수" }, { status: 400 });

  const result = await upsertEnrollmentForm({
    leadId: id,
    data: b.data,
    actorId: g.actorId,
    actorRole: g.actorRole,
    changeReason: b.changeReason ?? null,
    changeSource: b.changeSource as never,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  let advanced: { from: string; to: string } | null = null;

  // ── 자동 재제출 전이 ──
  // 본사가 verify_failed / verify_revise 로 회송했으면, 협력점이 신청서 수정/저장하는 순간
  // → revise_resubmit 으로 자동 전이. 별도 "재제출" 버튼 누를 필요 없음.
  if (g.lead.status === "verify_failed" || g.lead.status === "verify_revise") {
    const adv = await updateLeadStatus({
      leadId: id,
      newStatus: "revise_resubmit",
      actorRole: g.actorRole,
      changedById: g.actorId,
      memo: "[신청서 수정 후 재제출]",
      bypassStateMachine: g.actorRole === "hq",
    });
    if (!("error" in adv)) advanced = { from: g.lead.status, to: adv.lead.status };
  }
  // ── autoAdvance=true → consult_active/revise_resubmit → form_ready ──
  else if (b.autoAdvance && (g.lead.status === "consult_active" || g.lead.status === "revise_resubmit")) {
    const adv = await updateLeadStatus({
      leadId: id,
      newStatus: "form_ready",
      actorRole: g.actorRole,
      changedById: g.actorId,
      memo: "[신청서 작성 완료]",
      bypassStateMachine: g.actorRole === "hq",
    });
    if (!("error" in adv)) advanced = { from: g.lead.status, to: adv.lead.status };
  }

  return NextResponse.json({ ok: true, id: result.id, isNew: result.isNew, advanced });
}

/** PUT — 신청서 수정. verify_failed/verify_revise 상태면 자동 revise_resubmit 전이. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await gate(id);
  if ("err" in g) return g.err;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const b = body as { data?: EnrollmentFormInput; changeReason?: string; changeSource?: string };
  if (!b.data) return NextResponse.json({ error: "data 필수" }, { status: 400 });

  const result = await upsertEnrollmentForm({
    leadId: id, data: b.data, actorId: g.actorId, actorRole: g.actorRole,
    changeReason: b.changeReason ?? null,
    changeSource: b.changeSource as never,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  let advanced: { from: string; to: string } | null = null;
  if (g.lead.status === "verify_failed" || g.lead.status === "verify_revise") {
    const adv = await updateLeadStatus({
      leadId: id,
      newStatus: "revise_resubmit",
      actorRole: g.actorRole,
      changedById: g.actorId,
      memo: "[신청서 수정 후 재제출]",
      bypassStateMachine: g.actorRole === "hq",
    });
    if (!("error" in adv)) advanced = { from: g.lead.status, to: adv.lead.status };
  }

  return NextResponse.json({ ok: true, id: result.id, isNew: result.isNew, advanced });
}
