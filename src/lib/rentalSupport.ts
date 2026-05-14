/**
 * 협력점 렌탈지원금 표시·환원 계산.
 *
 *   Partner.rentalSupportAmount 의미: "협력점이 챙길 보장 마진"
 *   렌탈지원금(고객 환원) = 영업점수수료 − 보장 마진 − 사은품 환원 − 설치 환원
 *   - 차액이 음수면 0 (협력점이 자기 보장 못 채우므로 렌탈지원금 발생 안 함)
 *   - 만원 단위 절사 (예: ₩662,000 → ₩660,000)
 *
 *   영업자 있는 lead 의 경우 marginCap = sellerMargin (영업자 분배 후 영업점이
 *   가져가는 풀) 을 영업점수수료 대신 한도 기준으로 사용 → 협력점 마이너스 방지.
 *
 *   install_done 시 본사가 고객에 1회 캐시백 → Settlement 에서 협력점 수수료 차감.
 */

/** 만원 단위 floor (1만원 미만 절사) */
export function floorToManwon(n: number): number {
  if (n <= 0) return 0;
  return Math.floor(n / 10000) * 10000;
}

/**
 * 한 옵션의 표시 가능 렌탈지원금 계산.
 *   displayAmount = max(0, cap − partnerSupportAmount − gift − install) 만원 절사
 *   cap = marginCap (영업자 있을 때) or baseCommission (없을 때)
 */
export function computeOptionRentalSupport(args: {
  baseCommission: number | null | undefined; // 영업점수수료 (= 본사수수료 − 본사마진)
  partnerSupportAmount: number;              // 협력점이 챙길 보장 마진 (Partner.rentalSupportAmount)
  giftAmount: number;
  installAmount: number;
  marginCap?: number;                         // 영업자 있을 때 sellerMargin
}): { displayAmount: number; limit: number; inLimit: boolean; scaledDown: boolean } {
  const base = args.baseCommission ?? 0;
  const cap = args.marginCap != null ? Math.min(base, args.marginCap) : base;
  // 차액 = 협력점이 가져갈 풀(cap) − 협력점 보장 마진 − 환원
  const surplus = cap - args.partnerSupportAmount - args.giftAmount - args.installAmount;
  const support = floorToManwon(surplus > 0 ? surplus : 0);
  return {
    displayAmount: support,
    limit: Math.max(0, surplus),
    inLimit: surplus > 0,
    scaledDown: false,
  };
}

/** 단일 옵션의 노출·환원 금액. 차액 음수 시 0. 만원 단위 절사. */
export function rentalSupportFor(
  baseCommission: number | null | undefined,
  partnerSupportAmount: number,
  giftAmount: number = 0,
  installAmount: number = 0,
  marginCap?: number,
): number {
  return computeOptionRentalSupport({
    baseCommission, partnerSupportAmount, giftAmount, installAmount, marginCap,
  }).displayAmount;
}
