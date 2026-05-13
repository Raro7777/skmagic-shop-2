/**
 * Lead store — Postgres (Neon) via Prisma.
 *
 * Public surface unchanged from the in-memory version, so callers (API routes)
 * don't change.
 */

import { prisma } from "./prisma";
import { rentalSupportFor } from "./rentalSupport";
import {
  type LeadStatus,
  type ActorRole,
  canTransition,
  resolveChain,
  chainCreatesSettlement,
  isTerminal,
} from "./leadStatus";

export type { LeadStatus, ActorRole };

export type Lead = {
  id: string;
  createdAt: string;
  customerName: string;
  phoneRaw: string;
  productInterest: string;
  productCode: string | null;
  region: string;
  partnerId: string | null;
  sellerId: string | null;
  ownerType: "partner" | "hq_pool";
  source: "consumer_form" | "kakao" | "phone";
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
    referrer?: string;
    landingPath?: string;
    deviceType?: string;
  };
  status: LeadStatus;
  duplicateStatus: "confirmed" | "possible" | "bad_db" | null;
};

/* =====================================================================
   Ownership decision tree (rulebook 8.2)
   ===================================================================== */
export type OwnershipInput = {
  landingType: "consumer_partner" | "consumer_seller" | "region" | "main";
  partnerId?: string;
  sellerCode?: string;  // resolved to sellerId in captureLead
  region?: string;
};

export type OwnershipResult = {
  partnerId: string | null;
  ownerType: Lead["ownerType"];
  reason: string;
};

export function decideOwnership(input: OwnershipInput): OwnershipResult {
  if (input.landingType === "consumer_partner" && input.partnerId) {
    return { partnerId: input.partnerId, ownerType: "partner", reason: "partner_landing" };
  }
  if (input.landingType === "consumer_seller" && input.partnerId && input.sellerCode) {
    return { partnerId: input.partnerId, ownerType: "partner", reason: "seller_landing" };
  }
  if (input.landingType === "region" && input.region) {
    return { partnerId: "gangnam-skmagic", ownerType: "partner", reason: "region_default" };
  }
  return { partnerId: null, ownerType: "hq_pool", reason: "main_or_unmatched" };
}

/* =====================================================================
   Public API
   ===================================================================== */
export async function captureLead(input: {
  customerName: string;
  phone: string;
  productInterest: string;
  productCode?: string | null;
  region: string;
  ownership: OwnershipInput;
  utm?: Lead["utm"];
  // PriceConfigurator 선택 옵션 (룰북 priceMatrix)
  selectedMode?: "방문형" | "셀프형" | null;
  selectedContractPeriod?: number;
  selectedRentalPrice?: number;
  selectedCardDiscountPrice?: number | null;
  rivalCompensationRequested?: boolean;
  selectedColor?: string | null;
}): Promise<Lead> {
  let decision = decideOwnership(input.ownership);

  // 퇴점/정지 협력점 차단 — 룰북 14
  if (decision.partnerId) {
    const targetPartner = await prisma.partner.findUnique({
      where: { partnerCode: decision.partnerId },
      select: { status: true },
    });
    if (!targetPartner || targetPartner.status !== "active") {
      // 본사 풀로 강제 전환
      decision = { partnerId: null, ownerType: "hq_pool", reason: "partner_closed_fallback" };
    }
  }
  const phoneRaw = input.phone.replace(/\s+/g, "");

  // 9. Duplicate detection (rulebook 9.1 + A5):
  //   1순위: 휴대폰 번호 완전 일치 → 자동 confirmed
  //   2순위: 휴대폰 번호 + 이름 일치 (1순위와 거의 같지만 별도 plates) → possible
  //   3순위: 휴대폰 뒤 4자리 + 설치지역 첫 단어 일치 → possible
  let duplicateStatus: "confirmed" | "possible" | null = null;

  const exact = await prisma.lead.findFirst({
    where: { phoneRaw },
    select: { id: true },
  });
  if (exact) {
    duplicateStatus = "confirmed";
  } else {
    // 2순위: same name + phoneRaw last 4 + first 3 (often catches typos in middle)
    const last4 = phoneRaw.slice(-4);
    const customerName = input.customerName.trim().slice(0, 32);
    const regionTrim = (input.region ?? "").trim();
    const regionFirstWord = regionTrim.split(/\s+/)[0] ?? "";

    const orFilters = [];
    if (customerName) {
      orFilters.push({
        AND: [
          { customerName: customerName },
          { phoneRaw: { endsWith: last4 } },
        ],
      });
    }
    if (regionFirstWord && last4) {
      orFilters.push({
        AND: [
          { phoneRaw: { endsWith: last4 } },
          { region: { startsWith: regionFirstWord } },
        ],
      });
    }
    if (orFilters.length > 0) {
      const possibleMatch = await prisma.lead.findFirst({
        where: { OR: orFilters },
        select: { id: true },
      });
      if (possibleMatch) duplicateStatus = "possible";
    }
  }

  // Resolve sellerId from sellerCode if provided
  let sellerId: string | null = null;
  if (input.ownership.partnerId && input.ownership.sellerCode) {
    const seller = await prisma.seller.findUnique({
      where: {
        partnerId_sellerCode: {
          partnerId: input.ownership.partnerId,
          sellerCode: input.ownership.sellerCode,
        },
      },
      select: { id: true, status: true },
    });
    if (seller && seller.status === "active") sellerId = seller.id;
  }

  const created = await prisma.lead.create({
    data: {
      customerName: input.customerName.trim().slice(0, 32),
      phoneRaw,
      productInterest: input.productInterest.trim().slice(0, 64),
      productCode: input.productCode?.trim() || null,
      region: input.region?.trim().slice(0, 64) || null,
      partnerId: decision.partnerId,
      sellerId,
      ownerType: decision.ownerType,
      source: "consumer_form",
      utmSource: input.utm?.source?.slice(0, 64) ?? null,
      utmMedium: input.utm?.medium?.slice(0, 64) ?? null,
      utmCampaign: input.utm?.campaign?.slice(0, 64) ?? null,
      utmContent: input.utm?.content?.slice(0, 128) ?? null,
      utmTerm: input.utm?.term?.slice(0, 128) ?? null,
      referrer: input.utm?.referrer?.slice(0, 256) ?? null,
      landingPath: input.utm?.landingPath?.slice(0, 256) ?? null,
      deviceType: input.utm?.deviceType?.slice(0, 16) ?? null,
      status: "consult_wish",
      duplicateStatus,
      selectedMode: input.selectedMode ?? null,
      selectedContractPeriod: input.selectedContractPeriod ?? null,
      selectedRentalPrice: input.selectedRentalPrice ?? null,
      selectedCardDiscountPrice: input.selectedCardDiscountPrice ?? null,
      selectedColor: input.selectedColor?.trim() || null,
      rivalCompensationRequested: !!input.rivalCompensationRequested,
    },
  });

  return toDomain(created);
}

export async function listLeadsForPartner(partnerId: string, limit = 10): Promise<Lead[]> {
  const rows = await prisma.lead.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toDomain);
}

export async function listAllLeads(limit = 200): Promise<Lead[]> {
  const rows = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toDomain);
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const row = await prisma.lead.findUnique({ where: { id } });
  return row ? toDomain(row) : null;
}

/* =====================================================================
   Status state machine — 14단계 lifecycle (src/lib/leadStatus.ts)
   사용자가 한 번의 PATCH 로 to 상태에 보내면 autoFollowup chain 이 같은
   트랜잭션에서 자동으로 추가 진행됨.
       apply_submitted → verify_pending
       verify_passed   → install_pending
       install_done    → settle_pending  (+ Settlement 자동 생성)
   ===================================================================== */
export type StatusLogEntry = {
  id: string;
  leadId: string;
  previousStatus: LeadStatus;
  newStatus: LeadStatus;
  changedById: string | null;
  memo: string | null;
  createdAt: string;
};

export async function updateLeadStatus(input: {
  leadId: string;
  newStatus: LeadStatus;
  actorRole: ActorRole;
  changedById: string | null;
  memo?: string;
  /** 인증실패 / 수정요청 / 취소 등의 사유 (verifyLastReason / cancelReason 에 저장) */
  reason?: string;
  /** 본사 override — 임의 역전이 허용 (감사 로그는 남김) */
  bypassStateMachine?: boolean;
}): Promise<{ lead: Lead; logs: StatusLogEntry[] } | { error: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) return { error: "Lead not found" };

  const from = lead.status as LeadStatus;
  if (from === input.newStatus) return { error: "이미 같은 상태입니다." };

  // 전이 허용 검증 (역할 기반)
  if (!input.bypassStateMachine && !canTransition(from, input.newStatus, input.actorRole)) {
    return { error: `상태 전이 불가 또는 권한 없음: ${from} → ${input.newStatus} (${input.actorRole})` };
  }

  // form_ready 진입 가드 — EnrollmentForm 존재 필요 (본사 bypass 시 면제)
  if (input.newStatus === "form_ready" && !input.bypassStateMachine) {
    const form = await prisma.enrollmentForm.findUnique({ where: { leadId: input.leadId }, select: { id: true } });
    if (!form) return { error: "가입 신청서 작성이 필요합니다. (consult_active → form_ready 진입 전에 EnrollmentForm 생성 필요)" };
  }

  // 사용자가 누른 to + 자동 chain
  const chain = resolveChain(from, input.newStatus);
  const finalStatus = chain[chain.length - 1];

  // Settlement 생성 트리거 — chain 안에 install_done → settle_pending 포함 시
  const willCreateSettlement = chainCreatesSettlement(chain);
  const settlementPayload = willCreateSettlement
    ? await buildSettlementPayload(lead.id, lead.partnerId, lead.productCode, lead.productInterest, lead.selectedMode, lead.selectedContractPeriod, lead.sellerId)
    : null;

  // 컬럼 부수 업데이트
  const extraLeadData: Record<string, unknown> = {};
  if (input.newStatus === "revise_resubmit" || input.newStatus === "apply_submitted") {
    // 회신상태 진입 또는 회신 후 재제출 시 카운트 증가 (apply_submitted 는 신규 첫 제출도 포함 → 회신상태 거친 케이스만 +1)
    if (from === "verify_failed" || from === "verify_revise") {
      extraLeadData.verifyAttempts = { increment: 1 };
    }
  }
  if (input.newStatus === "verify_failed" || input.newStatus === "verify_revise") {
    extraLeadData.verifyLastReason = input.reason ?? null;
  }
  if (input.newStatus === "consult_closed" || input.newStatus === "install_cancel") {
    extraLeadData.cancelledAt = new Date();
    extraLeadData.cancelReason = input.reason ?? null;
  }
  // 종료 상태에서 다시 활성으로 돌아오면 cancel 정보 클리어
  if (!isTerminal(input.newStatus) && (from === "consult_closed" || from === "install_cancel")) {
    extraLeadData.cancelledAt = null;
    extraLeadData.cancelReason = null;
  }

  // 정산 cancel 트리거 — settle_pending/settle_done 에서 빠져나갈 때
  const leavingSettlement =
    (from === "settle_pending" || from === "settle_done") &&
    finalStatus !== "settle_pending" && finalStatus !== "settle_done";

  // 정산완료 마킹 — settle_done 진입 시 Settlement.status=paid + paidAt=now
  const markingSettlePaid = finalStatus === "settle_done" && from !== "settle_done";

  const { updated, logs } = await prisma.$transaction(async tx => {
    const updated = await tx.lead.update({
      where: { id: input.leadId },
      data: { status: finalStatus, ...extraLeadData },
    });

    // chain 의 각 step 별 LeadStatusLog 기록
    const logRows: typeof updated extends never ? never : Awaited<ReturnType<typeof tx.leadStatusLog.create>>[] = [];
    let prev = from;
    for (let i = 0; i < chain.length; i++) {
      const step = chain[i];
      const isUserStep = i === 0;
      const row = await tx.leadStatusLog.create({
        data: {
          leadId: input.leadId,
          previousStatus: prev,
          newStatus: step,
          changedById: isUserStep ? input.changedById : null, // 자동 chain 은 system
          memo: isUserStep ? (input.memo ?? input.reason ?? null) : "[auto chain]",
        },
      });
      logRows.push(row);
      prev = step;
    }

    if (settlementPayload) {
      // upsert — 재진입 케이스: 기존 cancelled row 를 최신 금액으로 pending 복원
      await tx.settlement.upsert({
        where: { leadId: input.leadId },
        create: settlementPayload,
        update: {
          partnerId: settlementPayload.partnerId,
          productCode: settlementPayload.productCode,
          productName: settlementPayload.productName,
          baseCommission: settlementPayload.baseCommission,
          giftReturned: settlementPayload.giftReturned,
          installReturned: settlementPayload.installReturned,
          netPayout: settlementPayload.netPayout,
          status: "pending",
          cancelledAt: null,
          paidAt: null,
        },
      });
    }

    if (markingSettlePaid) {
      await tx.settlement.updateMany({
        where: { leadId: input.leadId, status: { notIn: ["paid", "cancelled"] } },
        data: { status: "paid", paidAt: new Date() },
      });
    }

    if (leavingSettlement) {
      await tx.settlement.updateMany({
        where: { leadId: input.leadId, status: { in: ["pending", "confirmed", "paid"] } },
        data: { status: "cancelled", cancelledAt: new Date() },
      });
    }

    // EnrollmentForm 잠금/해제 — install_pending 진입 시 lock, 그 이전으로 되돌리면 unlock
    if (chain.includes("install_pending") && !chain.includes("install_cancel")) {
      await tx.enrollmentForm.updateMany({
        where: { leadId: input.leadId, lockedAt: null },
        data: { lockedAt: new Date() },
      });
    }
    // 본사가 verify_revise 등으로 회송 시 잠금 해제 (있다면)
    if (input.newStatus === "verify_revise" || input.newStatus === "verify_failed" || input.newStatus === "revise_resubmit") {
      await tx.enrollmentForm.updateMany({
        where: { leadId: input.leadId },
        data: { lockedAt: null },
      });
    }

    return { updated, logs: logRows };
  });

  return {
    lead: toDomain(updated),
    logs: logs.map(log => ({
      id: log.id,
      leadId: log.leadId,
      previousStatus: log.previousStatus as LeadStatus,
      newStatus: log.newStatus as LeadStatus,
      changedById: log.changedById,
      memo: log.memo,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

/**
 * Build a Settlement row payload based on lead + product policies.
 * Falls back to defaults if productCode is missing.
 */
async function buildSettlementPayload(
  leadId: string,
  partnerId: string | null,
  productCode: string | null,
  productInterest: string,
  selectedMode: string | null,
  selectedContractPeriod: number | null,
  sellerId: string | null,
) {
  // Skip if lead is in HQ pool (no partner to pay)
  if (!partnerId) return null;

  let baseCommission = 45000;
  let giftReturned = 0;
  let installReturned = 0;
  let rentalSupportReturned = 0;
  let resolvedProductName = productInterest;
  let hqPolicyForOption: Awaited<ReturnType<typeof prisma.hqPolicy.findFirst>> | null = null;
  let partnerPolicyForProduct: Awaited<ReturnType<typeof prisma.partnerPolicy.findFirst>> | null = null;

  // 협력점 정보 + 영업자 마진 기본값
  const partner = await prisma.partner.findUnique({
    where: { partnerCode: partnerId },
    select: {
      rentalSupportAmount: true, tier: true,
      sellerMarginType: true, sellerMarginAmount: true, sellerMarginPercent: true,
    },
  });
  const partnerSupportAmount = partner?.rentalSupportAmount ?? 0;

  if (productCode) {
    const product = await prisma.product.findUnique({
      where: { productCode },
      include: {
        hqPolicies: true,
        partnerPolicies: { where: { partnerId } },
      },
    });
    if (product) {
      resolvedProductName = product.name;
      // lead.selectedMode + lead.selectedContractPeriod 로 정확한 HqPolicy 옵션 lookup.
      const targetMode = selectedMode
        ?? (product.managementType.includes("자가") || product.managementType.includes("셀프") ? "셀프형" : "방문형");
      const targetPeriod = selectedContractPeriod ?? product.contractPeriod;
      const policy =
        product.hqPolicies.find(h => h.mode === targetMode && h.contractPeriod === targetPeriod)
        ?? product.hqPolicies.find(h => h.mode === targetMode && h.contractPeriod === 60)
        ?? product.hqPolicies[0];
      if (policy) {
        baseCommission = policy.baseCommission + policy.monthIncentive;
        hqPolicyForOption = policy;
      }
      const pp = product.partnerPolicies[0];
      if (pp) {
        giftReturned = pp.giftAmount;
        installReturned = pp.installAmount;
        partnerPolicyForProduct = pp;
      }
    }
  }

  // 본사 마진 계산 (티어 기본값 → 옵션 override)
  const tier = partner?.tier ?? "basic";
  const tierMargin = await prisma.hqMarginByTier.findUnique({ where: { tier } });
  const { computeHqMargin, computeSellerMargin, computeMarginFlow } = await import("./marginFlow");
  const hqMargin = computeHqMargin(
    baseCommission,
    hqPolicyForOption,
    tierMargin
      ? { type: tierMargin.marginType as "fixed" | "percent", amount: tierMargin.marginAmount, percent: tierMargin.marginPercent }
      : null,
  );
  const partnerCommission = baseCommission - hqMargin;

  // 영업자 마진 먼저 계산 (rentalSupport 한도 산정에 사용)
  const hasSeller = !!sellerId;
  const sellerMargin = hasSeller && partner
    ? computeSellerMargin(partnerCommission, partner, partnerPolicyForProduct)
    : 0;

  // 렌탈지원 — 한도 계산 기준:
  //   영업자 없음: partnerCommission - 환원
  //   영업자 있음: sellerMargin - 환원  (A안에서 협력점 실수령 = sellerMargin - 환원 이므로
  //                                       이를 0 이상으로 유지하려면 렌탈지원도 sellerMargin 내로 cap)
  rentalSupportReturned = rentalSupportFor(
    partnerCommission,
    partnerSupportAmount,
    giftReturned,
    installReturned,
    hasSeller ? sellerMargin : undefined,
  );

  const flow = computeMarginFlow({
    baseCommission,
    hqMargin,
    giftReturned,
    installReturned,
    rentalSupportReturned,
    sellerMargin,
    hasSeller,
  });

  const periodMonth = new Date().toISOString().slice(0, 7); // "2026-05"

  return {
    leadId,
    partnerId,
    productCode,
    productName: resolvedProductName,
    baseCommission: flow.baseCommission,
    hqMargin: flow.hqMargin,
    partnerCommission: flow.partnerCommission,
    giftReturned: flow.giftReturned,
    installReturned: flow.installReturned,
    rentalSupportReturned: flow.rentalSupportReturned,
    sellerMargin: flow.sellerMargin,
    sellerPayout: flow.sellerPayout,
    netPayout: flow.netPayout,
    periodMonth,
    status: "pending",
  };
}

export async function getStatusHistory(leadId: string): Promise<StatusLogEntry[]> {
  const rows = await prisma.leadStatusLog.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(r => ({
    id: r.id,
    leadId: r.leadId,
    previousStatus: r.previousStatus as LeadStatus,
    newStatus: r.newStatus as LeadStatus,
    changedById: r.changedById,
    memo: r.memo,
    createdAt: r.createdAt.toISOString(),
  }));
}

/* =====================================================================
   Phone masking (rulebook A3)
   ===================================================================== */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11) return phone;
  return `${digits.slice(0, 3)}-${digits[3]}***-${digits.slice(7)}`;
}

export function viewablePhone(lead: Lead, viewer: { partnerId: string | null }): string {
  const allowedRole = lead.ownerType === "partner" && lead.partnerId === viewer.partnerId;
  // 영업 활성 단계에서만 원본 전화번호 노출 — 본사 처리(인증/설치/정산)로 넘어가면 마스킹
  const activeStages: LeadStatus[] = ["consult_wish", "consult_active", "verify_failed", "verify_revise", "revise_resubmit"];
  const allowedStatus = activeStages.includes(lead.status);
  if (allowedRole && allowedStatus) return formatPhone(lead.phoneRaw);
  return maskPhone(lead.phoneRaw);
}

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.length !== 11) return p;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/* =====================================================================
   Mappers
   ===================================================================== */
type LeadRow = Awaited<ReturnType<typeof prisma.lead.findFirst>>;

function toDomain(row: NonNullable<LeadRow>): Lead {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    customerName: row.customerName,
    phoneRaw: row.phoneRaw,
    productInterest: row.productInterest,
    region: row.region ?? "",
    partnerId: row.partnerId,
    ownerType: row.ownerType as Lead["ownerType"],
    source: row.source as Lead["source"],
    utm:
      row.utmSource || row.utmMedium || row.utmCampaign || row.utmContent || row.utmTerm || row.referrer
        ? {
            source:      row.utmSource ?? undefined,
            medium:      row.utmMedium ?? undefined,
            campaign:    row.utmCampaign ?? undefined,
            content:     row.utmContent ?? undefined,
            term:        row.utmTerm ?? undefined,
            referrer:    row.referrer ?? undefined,
            landingPath: row.landingPath ?? undefined,
            deviceType:  row.deviceType ?? undefined,
          }
        : undefined,
    status: row.status as LeadStatus,
    duplicateStatus: (row.duplicateStatus as Lead["duplicateStatus"]) ?? null,
    productCode: row.productCode ?? null,
    sellerId: row.sellerId ?? null,
  };
}
