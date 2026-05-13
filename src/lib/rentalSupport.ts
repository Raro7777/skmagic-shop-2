/**
 * 협력점 렌탈지원금 표시 계산.
 *
 *   옵션 한도 = priceMatrix[옵션].baseCommission − 사은품 환원 − 설치 환원
 *   표시 금액 = (옵션 한도 ≥ 협력점 설정) ? 협력점 설정 (만원 단위 절사) : 0
 *
 *  - 협력점은 단일 금액(총액) 1번 설정. 모든 상품·옵션 공통.
 *  - 한도 초과 시 음수 X, 0 표기 (협력점이 그 옵션엔 약속 못 지킴).
 *  - 표시·환원 금액은 **만원 단위 절사** (예: ₩662,000 → ₩660,000).
 *  - install_done 시 본사가 고객에 1회 캐시백 → Settlement 에서 협력점 수수료 차감.
 */

/** 만원 단위 floor (1만원 미만 절사) */
export function floorToManwon(n: number): number {
  if (n <= 0) return 0;
  return Math.floor(n / 10000) * 10000;
}

/** 한 옵션의 표시 가능 렌탈지원금 계산 */
export function computeOptionRentalSupport(args: {
  baseCommission: number | null | undefined;     // priceMatrix[옵션].baseCommission (수수료 합계)
  partnerSupportAmount: number;                  // 협력점 단일 설정 금액
  giftAmount: number;                            // PartnerPolicy.giftAmount (사은품 환원)
  installAmount: number;                         // PartnerPolicy.installAmount (설치비 환원)
}): { displayAmount: number; limit: number; inLimit: boolean } {
  const base = args.baseCommission ?? 0;
  const limit = Math.max(0, base - args.giftAmount - args.installAmount);
  const inLimit = limit >= args.partnerSupportAmount && args.partnerSupportAmount > 0;
  // 한도 안에 들어가면 협력점 설정값 그대로 — 단 만원 단위 절사
  return {
    displayAmount: inLimit ? floorToManwon(args.partnerSupportAmount) : 0,
    limit,
    inLimit,
  };
}

/** 단일 옵션(또는 product 기본가) 의 노출 금액. 한도 부족 시 0. 만원 단위 절사 적용. */
export function rentalSupportFor(
  baseCommission: number | null | undefined,
  partnerSupportAmount: number,
  giftAmount: number = 0,
  installAmount: number = 0,
): number {
  return computeOptionRentalSupport({ baseCommission, partnerSupportAmount, giftAmount, installAmount }).displayAmount;
}
