/**
 * 본사 정책상 자주 등장하는 매직 넘버 단일 출처.
 *
 * 정책이 바뀌면 여기 한 곳만 고치면 모든 화면/스크립트/계산식에 일괄 반영된다.
 */

/** 매직몰 카드할인 최대 (2026-05 기준 23,000원/월). PriceConfigurator·CardBenefitsPanel·Product top-level 계산 공통. */
export const CARD_DISCOUNT_MAX = 23000;

/** 렌탈지원금 (대당 최대 캐시백 한도). HqPolicy 기본 commission 에서 차감하여 협력점 캐시백 노출. */
export const RENTAL_SUPPORT_AMOUNT = 200000;

/** 본사가 협력점에 지급하는 대당 설치보조 (HqPolicy.installSubsidy 기본값). */
export const INSTALL_SUBSIDY_DEFAULT = 30000;

/** HqPolicy.baseCommission 신규 행 생성 시 기본값 (정책 import 전 임시). */
export const BASE_COMMISSION_DEFAULT = 30000;

/** 환수 한도 비율 — 수수료의 2/3 (소수점 4자리까지). 정산 환수 산출 공통. */
export const REFUND_LIMIT_RATIO = 0.6667;

/** 부가가치세율 (10%). 본사 정책표 col15 는 VAT 포함값 → ÷ 1.1 로 공급가액 산출. */
export const VAT_RATE = 1.1;
