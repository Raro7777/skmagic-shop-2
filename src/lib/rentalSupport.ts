/**
 * 협력점 렌탈지원금 표시·환원 계산.
 *
 *   기본 한도 = baseCommission − 사은품 환원 − 설치 환원
 *   marginCap 지정 시 한도 = min(기본 한도, marginCap − 환원)
 *     ↳ 영업자 있는 lead 의 경우 sellerMargin 을 marginCap 으로 넘겨 협력점 마이너스 방지.
 *
 *   협력점 설정값(partnerSupportAmount) 이 한도보다 크면 → 한도까지 자동 다운스케일
 *     (이전엔 0 표기였으나 사용자 요구로 다운스케일 — 마이너스 방지 + 일부라도 환원 적용).
 *
 *  - 협력점은 단일 금액(총액) 1번 설정. 모든 상품·옵션 공통.
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
  baseCommission: number | null | undefined; // 본사 수수료 합계
  partnerSupportAmount: number;              // 협력점 단일 설정 금액
  giftAmount: number;                        // 사은품 환원
  installAmount: number;                     // 설치 환원
  marginCap?: number;                        // 영업자 있을 때 sellerMargin (옵션)
}): { displayAmount: number; limit: number; inLimit: boolean; scaledDown: boolean } {
  const base = args.baseCommission ?? 0;
  // 영업자 있을 때 sellerMargin 이 base 보다 작으면 그것이 진짜 한도
  const cap = args.marginCap != null ? Math.min(base, args.marginCap) : base;
  const limit = Math.max(0, cap - args.giftAmount - args.installAmount);
  const desired = args.partnerSupportAmount > 0 ? args.partnerSupportAmount : 0;
  // 한도 초과 시 한도까지 다운스케일 (마이너스 방지). 한도 0 이하면 0.
  const support = floorToManwon(Math.min(desired, limit));
  const inLimit = limit >= desired && desired > 0;
  const scaledDown = desired > 0 && support < desired;
  return { displayAmount: support, limit, inLimit, scaledDown };
}

/** 단일 옵션의 노출·환원 금액. 한도 부족 시 자동 다운스케일. 만원 단위 절사 적용. */
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
