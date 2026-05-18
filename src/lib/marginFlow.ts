/**
 * 마진 흐름 계산 헬퍼 — 3계층 정산 로직.
 *
 *   본사수수료 (baseCommission)
 *     - 본사마진 (hqMargin: 티어 기본값 또는 상품별 override)
 *   = 영업점수수료 (partnerCommission)        ★ 정책 표기 숫자 · 환수 기준
 *     - 환원 (giftReturned + installReturned + rentalSupportReturned)
 *     = 영업점이 가져가는 풀
 *
 *   영업자 없을 때: netPayout = 영업점수수료 - 환원                 (영업점이 다 가져감)
 *   영업자 있을 때: sellerPayout = 영업점수수료 - 영업점마진
 *                  netPayout    = 영업점수수료 - 환원 - sellerPayout
 *                               = sellerMargin - 환원              (영업점 실수령. 환원이 크면 마이너스 가능)
 *
 * 환수는 partnerCommission 기준 (영업자 무관).
 */
import type { HqPolicy, Partner, PartnerPolicy } from "@prisma/client";

export type MarginConfig = {
  type: "fixed" | "percent";
  amount: number;   // type=fixed 일 때
  percent: number;  // type=percent 일 때 (0~1)
};

/** computeHqMargin 가 실제로 읽는 필드만 — 호출처에서 좁은 타입 전달 가능. */
export type HqMarginInput = Pick<HqPolicy, "marginType" | "marginAmount" | "marginPercent">;

/** 본사 마진을 계산. HqPolicy.margin* 가 있으면 우선, 없으면 티어 기본값. */
export function computeHqMargin(
  baseCommission: number,
  hqPolicy: HqMarginInput | null,
  tierDefault: MarginConfig | null,
): number {
  if (hqPolicy?.marginType === "fixed" && hqPolicy.marginAmount != null) {
    return clampToCommission(hqPolicy.marginAmount, baseCommission);
  }
  if (hqPolicy?.marginType === "percent" && hqPolicy.marginPercent != null) {
    return clampToCommission(Math.floor(baseCommission * hqPolicy.marginPercent), baseCommission);
  }
  if (tierDefault) {
    if (tierDefault.type === "fixed") {
      return clampToCommission(tierDefault.amount, baseCommission);
    }
    return clampToCommission(Math.floor(baseCommission * tierDefault.percent), baseCommission);
  }
  return 0;
}

/**
 * 영업자 마진(= 영업점이 자기 몫으로 떼는 액수)을 계산.
 * PartnerPolicy.sellerMargin* 가 있으면 우선, 없으면 Partner.sellerMargin* 기본값.
 * Percent 기준은 partnerCommission(영업점수수료) 에 곱.
 */
export function computeSellerMargin(
  partnerCommission: number,
  partner: Pick<Partner, "sellerMarginType" | "sellerMarginAmount" | "sellerMarginPercent">,
  override: Pick<PartnerPolicy, "sellerMarginAmount" | "sellerMarginPercent"> | null,
): number {
  if (override?.sellerMarginAmount != null) {
    return clampToCommission(override.sellerMarginAmount, partnerCommission);
  }
  if (override?.sellerMarginPercent != null) {
    return clampToCommission(Math.floor(partnerCommission * override.sellerMarginPercent), partnerCommission);
  }
  if (partner.sellerMarginType === "fixed") {
    return clampToCommission(partner.sellerMarginAmount, partnerCommission);
  }
  return clampToCommission(Math.floor(partnerCommission * partner.sellerMarginPercent), partnerCommission);
}

function clampToCommission(value: number, commission: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, Math.max(0, commission));
}

export type MarginFlowResult = {
  baseCommission: number;
  hqMargin: number;
  partnerCommission: number;     // 정책 표기 + 환수 기준
  giftReturned: number;
  installReturned: number;
  rentalSupportReturned: number;
  sellerMargin: number;          // 영업자 있을 때만 > 0
  sellerPayout: number;          // 영업자 있을 때만 > 0
  netPayout: number;             // 협력점 실수령
};

export function computeMarginFlow(input: {
  baseCommission: number;
  hqMargin: number;
  giftReturned: number;
  installReturned: number;
  rentalSupportReturned: number;
  sellerMargin: number;          // 영업자 없으면 0
  hasSeller: boolean;
}): MarginFlowResult {
  const partnerCommission = input.baseCommission - input.hqMargin;
  const totalReturned = input.giftReturned + input.installReturned + input.rentalSupportReturned;

  if (!input.hasSeller) {
    return {
      baseCommission: input.baseCommission,
      hqMargin: input.hqMargin,
      partnerCommission,
      giftReturned: input.giftReturned,
      installReturned: input.installReturned,
      rentalSupportReturned: input.rentalSupportReturned,
      sellerMargin: 0,
      sellerPayout: 0,
      netPayout: partnerCommission - totalReturned, // 영업점이 다 가져감 (환원만 제외)
    };
  }

  // 영업자 있을 때 — A안: 영업점이 환원 부담
  //   sellerPayout = 영업점수수료 - 영업점마진 (환원과 무관)
  //   영업점 실수령 = 영업점마진 - 환원 (음수 가능)
  const sellerPayout = Math.max(0, partnerCommission - input.sellerMargin);
  const netPayout = input.sellerMargin - totalReturned;
  return {
    baseCommission: input.baseCommission,
    hqMargin: input.hqMargin,
    partnerCommission,
    giftReturned: input.giftReturned,
    installReturned: input.installReturned,
    rentalSupportReturned: input.rentalSupportReturned,
    sellerMargin: input.sellerMargin,
    sellerPayout,
    netPayout,
  };
}
