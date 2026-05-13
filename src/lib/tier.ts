/**
 * 분양 패키지 tier (룰북 25)
 *
 * 4단계 — 협력점이 가진 분양권의 등급. HQ가 변경 가능.
 * 라우트/컴포넌트에서 canUseFeature로 게이팅.
 */

export type Tier = "basic" | "standard" | "premium" | "enterprise";

export const TIER_LIST: Tier[] = ["basic", "standard", "premium", "enterprise"];

export const TIER_RANK: Record<Tier, number> = {
  basic: 0,
  standard: 1,
  premium: 2,
  enterprise: 3,
};

export const TIER_LABEL: Record<Tier, string> = {
  basic: "기본",
  standard: "스탠다드",
  premium: "프리미엄",
  enterprise: "엔터프라이즈",
};

export const TIER_PILL: Record<Tier, string> = {
  basic:      "bg-rk-soft text-rk-muted",
  standard:   "bg-rk-tint-blue text-rk-info",
  premium:    "bg-rk-tint-orange text-rk-orange-deep",
  enterprise: "bg-rk-navy text-white",
};

/**
 * 기능별 최소 필요 tier — 협력점 콘솔에서 lock 처리.
 * 새 기능 추가 시 여기에 등록 → canUseFeature(tier, key)로 검사.
 */
export const FEATURES = {
  display_drag: {
    minTier: "standard" as Tier,
    label: "상품 진열 드래그 편집",
    description: "메인 페이지 hero/picks/ranking 노출 순서를 직접 드래그로 편집",
  },
  banner_schedule: {
    minTier: "standard" as Tier,
    label: "이벤트 배너 편성",
    description: "협력점 사이트 hero 슬라이더에 자체 배너 등록 + 시간 예약",
  },
  ab_test: {
    minTier: "premium" as Tier,
    label: "AB 테스트",
    description: "배너 50/50 분배 + 전환율 비교 (개발 예정)",
  },
  unlimited_sellers: {
    minTier: "premium" as Tier,
    label: "영업자 수 제한 해제",
    description: "기본 5명 한도를 무제한으로 확장",
  },
  hq_data_access: {
    minTier: "enterprise" as Tier,
    label: "본사 데이터 직접 접근",
    description: "HQ 마케팅 분석 / 다른 협력점 비교 데이터 열람",
  },
} as const;
export type FeatureKey = keyof typeof FEATURES;

/** 영업자 수 한도 — null이면 무제한 */
export const SELLER_LIMIT: Record<Tier, number | null> = {
  basic: 1,
  standard: 5,
  premium: null,
  enterprise: null,
};

/** 사은품 환원 한도 비율 — 본사 기본은 ⅔, premium 이상은 80%까지 (HqPolicy.refundLimitRatio override) */
export const REFUND_LIMIT_RATIO_OVERRIDE: Record<Tier, number | null> = {
  basic: null,           // 본사 기본값 사용
  standard: null,
  premium: 0.8,
  enterprise: 0.85,
};

export function canUseFeature(tier: string, feature: FeatureKey): boolean {
  const f = FEATURES[feature];
  if (!f) return true;
  const partnerRank = TIER_RANK[(tier as Tier)] ?? 0;
  const minRank = TIER_RANK[f.minTier];
  return partnerRank >= minRank;
}

export function getSellerLimit(tier: string): number | null {
  return SELLER_LIMIT[(tier as Tier)] ?? SELLER_LIMIT.basic;
}

export function getRefundLimitRatio(tier: string, defaultRatio: number): number {
  return REFUND_LIMIT_RATIO_OVERRIDE[(tier as Tier)] ?? defaultRatio;
}

/** "이 기능을 쓰려면 어떤 tier가 필요한가" 라벨 — UI 안내용 */
export function requiredTierLabel(feature: FeatureKey): string {
  return TIER_LABEL[FEATURES[feature].minTier];
}
