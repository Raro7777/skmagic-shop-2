import { prisma } from "@/lib/prisma";
import { pickRepresentativeHqPolicy } from "@/lib/hqPolicy";
import { computeHqMargin, computeSellerMargin } from "@/lib/marginFlow";
import { rentalSupportFor } from "@/lib/rentalSupport";
import { sanitizeBannerHtml } from "@/lib/sanitizeBannerHtml";

/**
 * 컨슈머 사이트 브랜드 통일 — 모든 협력점을 "SK매직 인증파트너점" 단일 브랜드로 노출.
 * 협력점 고유명 (인터넷끝판왕 등) 은 admin/franchise 콘솔에서만 사용.
 * 본사 정책 결정사항 — 브랜드 일관성 + 협력점간 위계 평준화.
 * 2026-06-01 브랜드 지킴이 검수 반영: 기존 표기 → "인증파트너점" 으로 갱신.
 */
export const CONSUMER_BRAND_NAME = "SK매직 인증파트너점";

/** 상품의 옵션별 렌탈지원금 중 최대값 계산. enabled=false면 0.
 *  본사-협력점: baseCommission − hqMargin = partnerCommission  (협력점 페이지 cap)
 *  협력점-영업자: partnerCommission − sellerMargin = sellerPayout (영업자 페이지 cap)
 *  영업자 컨텍스트면 base 자체를 sellerPayout 으로 한 단계 더 차감.
 */
function computeMaxRentalSupport(args: {
  hqPolicies: Array<{ baseCommission: number; monthIncentive: number; marginType: string | null; marginAmount: number | null; marginPercent: number | null }>;
  tierMargin: { type: "fixed" | "percent"; amount: number; percent: number } | null;
  partnerSupportAmount: number;
  rentalSupportEnabled: boolean;
  giftAmount: number;
  installAmount: number;
  // 영업자 컨텍스트 — sellerMargin 산식 (옵션별 partnerCommission 에 적용).
  // null 이면 협력점 컨텍스트 (sellerMargin 차감 없음).
  sellerMarginPartner?: Pick<import("@prisma/client").Partner, "sellerMarginType" | "sellerMarginAmount" | "sellerMarginPercent"> | null;
  sellerMarginPolicies?: Array<{ productId: string; sellerMarginAmount: number | null; sellerMarginPercent: number | null }>;
  productId?: string;
}): number {
  if (!args.rentalSupportEnabled || args.partnerSupportAmount <= 0) return 0;
  let max = 0;
  for (const opt of args.hqPolicies) {
    const base = opt.baseCommission + opt.monthIncentive;
    const hqMargin = computeHqMargin(base, opt, args.tierMargin);
    const partnerCommission = base - hqMargin;
    // 영업자 컨텍스트면 partnerCommission 에서 sellerMargin 한 번 더 차감하여 영업자 cap.
    let effectiveCommission = partnerCommission;
    if (args.sellerMarginPartner) {
      const override = args.productId
        ? args.sellerMarginPolicies?.find(p => p.productId === args.productId) ?? null
        : null;
      const sellerMargin = computeSellerMargin(partnerCommission, args.sellerMarginPartner, override);
      effectiveCommission = Math.max(0, partnerCommission - sellerMargin);
    }
    const s = rentalSupportFor(effectiveCommission, args.partnerSupportAmount, args.giftAmount, args.installAmount);
    if (s > max) max = s;
  }
  return max;
}

export type ConsumerProduct = {
  productCode: string;
  category: string;
  name: string;
  modelName: string;
  // rentalPrice = effective 월요금 = promo ?? operational (사용자 청구 기준).
  // 메인 카드 헤드라인에 노출. UI 코드 호환을 위해 필드명 유지.
  rentalPrice: number;
  // baseRentalPrice = 기준가 (할인 전). effective 와 다를 때만 취소선으로 표시.
  baseRentalPrice: number | null;
  // promoApplied = 5월 전사할인 (판촉가) 이 effective 에 적용된 모델인지. 라벨용.
  promoApplied: boolean;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  managementType: string;
  isFeatured: boolean;
  imageUrl: string | null;          // 카드용 대표 이미지 (imageUrls[0] 또는 imageUrl)
  // 신규 상품 — Product.createdAt 기준 최근 14일. 카테고리 랭킹/picks 자동 산출 시 맨 앞 우선 배치.
  isNew: boolean;
  // Partner-specific differentiation
  giftAmount: number;
  giftLabel: string | null;
  installFreed: boolean;
  // 옵션별 렌탈지원금 중 최대값 (메인 카드 배지용). enabled=false 또는 모든 옵션 0이면 0.
  maxRentalSupport: number;
  // 타사보상 — 최저 옵션 기준 추가 할인액. 모델에 정책 없으면 0.
  // 메인 카드에 "타사 사용중이면 추가 -X" 칩 노출용.
  maxRivalSavings: number;
  // 타사보상 + 카드할인까지 누적 적용한 정상 월요금 (반값 종료 이후 가격).
  // 적용 순서: 원래 요금 → 타사전환가 → 동일 옵션의 카드할인 차감.
  // 모델에 타사 정책 없으면 null. "🔄 타사 적용시 월 ₩X부터" 표시용 (카드는 별도).
  minRivalPrice: number | null;
  // 반값 기간 개월수 (0 이면 반값 정책 없음). 채택된 minRivalPrice 옵션 기준.
  rivalHalfMonths: number;
  // 반값 기간 월요금 ((rival/2) − cardDelta). 반값 정책 있는 모델만 사용 (halfMonths > 0).
  rivalHalfPrice: number | null;
  // pickLowestPrice 가 채택한 옵션의 mode — 메인 카드 관리방식 라벨에 반영.
  // 셀프형이 더 저렴하면 자가관리형으로 안내 (null 이면 기존 managementType 사용).
  lowestMode: "방문형" | "셀프형" | null;
};

function pickThumbnail(p: { imageUrl: string | null; imageUrls: string[] }): string | null {
  return p.imageUrls?.[0] ?? p.imageUrl ?? null;
}

/**
 * 브랜드 안전모드(brandSafeMode) 기반 effective 렌탈지원금 enable 판정.
 *
 *   - 협력점이 자체 OFF (rentalSupportEnabled=false) → 그대로 false
 *   - brandSafeMode + 컨슈머 메인(sellerCode 없음) → 차단 (false)
 *   - brandSafeMode + 영업자 컨텍스트(sellerCode 있음) → 풀 노출 (true)
 *   - brandSafeMode OFF → 협력점 enable 값 그대로
 *
 * 메모리: 브랜드 지킴이 회피 — 광고 클릭→영업자 URL 진입 흐름에서만 렌탈지원금 노출.
 */
function effectiveRentalSupportEnabled(
  partner: { rentalSupportEnabled: boolean; brandSafeMode: boolean },
  sellerCode: string | undefined,
): boolean {
  if (!partner.rentalSupportEnabled) return false;
  if (partner.brandSafeMode && !sellerCode) return false;
  return true;
}

/**
 * BRAND GUARD 인증 영상 effective URL.
 *   - brandSafeMode + sellerCode 컨텍스트(영업자 페이지에서 렌탈지원금 노출) → 인증 마크 숨김.
 *     이유: 본사 정품 인증 마크가 브랜드 지킴이 검사 회피 영역과 함께 노출되면 본사 신뢰도 훼손.
 *   - 그 외(brandSafeMode 꺼져있거나, 컨슈머 메인 컨텍스트) → 그대로 노출.
 */
function effectiveBrandGuardUrl(
  partner: { brandGuardVideoUrl: string | null; brandSafeMode: boolean },
  sellerCode: string | undefined,
): string | null {
  if (partner.brandSafeMode && sellerCode) return null;
  return partner.brandGuardVideoUrl;
}

// 옵션 단위 effective 가격 — 표시 우선순위: promoPrice ?? rentalPrice. base 는 취소선용.
function optionPrices(opt: Record<string, unknown>): {
  base: number | null;
  rental: number;          // 운영가 (원본)
  effective: number;       // promo ?? rental
  promoApplied: boolean;
  card: number | null;     // option.cardDiscountPrice (already effective − 15k)
} {
  const rental = Number(opt.rentalPrice ?? 0);
  const promo = opt.promoPrice != null && Number(opt.promoPrice) > 0 ? Number(opt.promoPrice) : null;
  const base = opt.basePrice != null && Number(opt.basePrice) > 0 ? Number(opt.basePrice) : null;
  const effective = promo ?? rental;
  const card = opt.cardDiscountPrice != null && Number(opt.cardDiscountPrice) > 0 ? Number(opt.cardDiscountPrice) : null;
  return { base, rental, effective, promoApplied: promo != null, card };
}

// priceMatrix 에서 최저 effective 옵션 picking.
// "effective" = promo ?? rental. 비교 시 카드 적용가가 있으면 그것을 사용.
// 셀프형이 더 저렴하면 자연스럽게 셀프형이 채택되어 자가관리형으로 라벨링됨.
function pickLowestPrice(
  raw: unknown,
  fallback: { rentalPrice: number; cardDiscountPrice: number | null; baseRentalPrice: number | null; promoRentalPrice: number | null },
): {
  rentalPrice: number;            // effective
  baseRentalPrice: number | null;
  promoApplied: boolean;
  cardDiscountPrice: number | null;
  mode: "방문형" | "셀프형" | null;
} {
  const fallbackEffective = fallback.promoRentalPrice ?? fallback.rentalPrice;
  if (!Array.isArray(raw) || raw.length === 0) {
    return {
      rentalPrice: fallbackEffective,
      baseRentalPrice: fallback.baseRentalPrice,
      promoApplied: fallback.promoRentalPrice != null,
      cardDiscountPrice: fallback.cardDiscountPrice,
      mode: null,
    };
  }
  let best = {
    rentalPrice: fallbackEffective,
    baseRentalPrice: fallback.baseRentalPrice,
    promoApplied: fallback.promoRentalPrice != null,
    cardDiscountPrice: fallback.cardDiscountPrice,
    mode: null as "방문형" | "셀프형" | null,
  };
  let bestKey = best.cardDiscountPrice ?? best.rentalPrice;
  for (const opt of raw as Array<Record<string, unknown>>) {
    const { base, effective, promoApplied, card } = optionPrices(opt);
    if (!effective || effective <= 0) continue;
    const compareKey = card != null && card < effective ? card : effective;
    if (compareKey < bestKey) {
      bestKey = compareKey;
      best = {
        rentalPrice: effective,
        baseRentalPrice: base,
        promoApplied,
        cardDiscountPrice: card,
        mode: opt.mode === "방문형" || opt.mode === "셀프형" ? opt.mode : null,
      };
    }
  }
  return best;
}

// 타사보상 옵션 중 (rentalPrice - rivalCompensationPrice) 최대값 = 최대 할인액
// 0 이면 모델에 타사보상 정책 없음 → 칩 안 보임.
function maxRivalSavings(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  let max = 0;
  for (const opt of raw as Array<Record<string, unknown>>) {
    const rental = Number(opt.rentalPrice ?? 0);
    const rival = opt.rivalCompensationPrice != null ? Number(opt.rivalCompensationPrice) : null;
    if (rental > 0 && rival != null && rival > 0 && rival < rental) {
      const saving = rental - rival;
      if (saving > max) max = saving;
    }
  }
  return max;
}

// 타사보상 + (있으면) 반값 기간 반영한 최저 시나리오.
// 카드할인은 별개 적용으로 처리 — SK매직 청구 기준만 표시하고 카드는 별도 라벨로 안내.
// (상세페이지 PriceConfigurator 의 "4개월차부터 월 X원으로 청구 — 카드 추가 할인은 별개 적용"
//  표현과 일관되도록 메인 카드도 카드 미스택으로 통일.)
//
// 반환값:
//   monthly      — 반값 기간 종료 이후 정상 월요금 (= rivalCompensationPrice, 카드 별도)
//   halfMonths   — 반값 적용 개월수 (0 이면 반값 정책 없음)
//   halfMonthly  — 반값 기간 월요금 (= rival × 0.5, 카드 별도)
// 모델에 타사 정책 없으면 null.
//
// 비교 기준: 반값 정책 있는 옵션 우선 채택, 같은 그룹 내에선 rival 이 가장 낮은 옵션.

function bestRivalPrice(raw: unknown): { monthly: number; halfMonths: number; halfMonthly: number } | null {
  if (!Array.isArray(raw)) return null;
  type RivalOpt = { monthly: number; halfMonths: number; halfMonthly: number };
  let bestHalf: RivalOpt | null = null;
  let bestPlain: RivalOpt | null = null;
  for (const opt of raw as Array<Record<string, unknown>>) {
    const rental = Number(opt.rentalPrice ?? 0);
    if (!rental || rental <= 0) continue;
    const rival = opt.rivalCompensationPrice != null ? Number(opt.rivalCompensationPrice) : null;
    if (rival == null || rival <= 0) continue;
    const halfMonths = Math.max(0, Math.floor(Number(opt.rivalCompensationHalfPriceMonths ?? 0)));
    // 카드할인 미스택 — SK매직 청구 그대로 노출. 카드 별개 표기는 UI 라벨에서 처리.
    const monthly = rival;
    const halfMonthly = Math.max(0, Math.round(rival * 0.5));
    if (halfMonths > 0) {
      if (bestHalf == null || monthly < bestHalf.monthly) bestHalf = { monthly, halfMonths, halfMonthly };
    } else {
      if (bestPlain == null || monthly < bestPlain.monthly) bestPlain = { monthly, halfMonths, halfMonthly };
    }
  }
  return bestHalf ?? bestPlain;
}

// 카드할인가가 운영가 이상이면 의미가 없으므로 null로 정규화.
// 데이터 문제가 있더라도 화면에 잘못된 "할인" 메시지가 노출되지 않게 보장.
function effectiveCardDiscount(rentalPrice: number, cardDiscountPrice: number | null): number | null {
  if (cardDiscountPrice == null) return null;
  if (cardDiscountPrice >= rentalPrice) return null;
  return cardDiscountPrice;
}

export type ActiveBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  bgColor1: string;
  bgColor2: string;
  textColor: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  endsAt: string; // ISO — 클라이언트에서 카운트다운 표시 가능
  layout: "classic" | "image-bg" | "product-spotlight" | "promo-stamp" | "html" | "image-only";
  spotlightProductCode: string | null;
  spotlightProductImage: string | null;
  stampText: string | null;
  htmlContent: string | null; // layout=html 일 때 sanitize 된 마크업
};

export type CategoryEntry = {
  slug: string;
  label: string;
  icon: string;
  count: number;        // 활성 상품 수
  isHot: boolean;       // QUICK nav 강조 여부
};

export type ReviewListItem = {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  productName: string | null;
  modelName: string | null;
  region: string | null;
  isVerified: boolean;
  installPhotoUrl: string | null;
  photos: string[];
  daysAgo: number;
};

export type LiveActivityItem = {
  id: string;
  customerName: string;
  productName: string;
  region: string | null;
  status: string; // 접수완료 / 상담대기 / 설치완료
  minutesAgo: number;
};

/**
 * 영업자 페이지(/p/[code]/s/[seller]) 에서 협력점 footer 정보를 영업자 본인 값으로 덮어씀.
 * 각 필드 null 이면 협력점 값 유지. 헤더는 본사 정책상 SK매직 공식 로고 고정이라 적용 X.
 */
export function applySellerFooterOverrides<P extends PartnerSiteData["partner"]>(
  partner: P,
  seller: {
    companyName: string | null;
    ownerName: string | null;
    address: string | null;
    businessNumber: string | null;
    commerceNumber: string | null;
    hotlineNumber: string | null;
    csHours: string | null;
    csLunchHours: string | null;
    csHolidays: string | null;
    kakaoChannelUrl: string | null;
    footerLogoUrl: string | null;
  } | null,
): P {
  if (!seller) return partner;
  return {
    ...partner,
    companyName:     seller.companyName     ?? partner.companyName,
    ownerName:       seller.ownerName       ?? partner.ownerName,
    address:         seller.address         ?? partner.address,
    businessNumber:  seller.businessNumber  ?? partner.businessNumber,
    commerceNumber:  seller.commerceNumber  ?? partner.commerceNumber,
    hotlineNumber:   seller.hotlineNumber   ?? partner.hotlineNumber,
    csHours:         seller.csHours         ?? partner.csHours,
    csLunchHours:    seller.csLunchHours    ?? partner.csLunchHours,
    csHolidays:      seller.csHolidays      ?? partner.csHolidays,
    kakaoChannelUrl: seller.kakaoChannelUrl ?? partner.kakaoChannelUrl,
    footerLogoUrl:   seller.footerLogoUrl   ?? partner.footerLogoUrl,
  };
}

export type PartnerSiteData = {
  partner: {
    partnerCode: string;
    partnerName: string;
    brandLabel: string;
    // 협력점 법인/상호 원본명 — 푸터의 "상호" 표기에만 사용.
    // partnerName/brandLabel 은 CONSUMER_BRAND_NAME 으로 덮였기 때문에 raw 값을 별도 보존.
    companyName: string;
    region: string | null;
    address: string | null;
    businessNumber: string | null;
    commerceNumber: string | null;
    hotlineNumber: string;
    kakaoChannelUrl: string | null;
    ownerName: string | null;
    csHours: string | null;
    csLunchHours: string | null;
    csHolidays: string | null;
    footerLogoUrl: string | null;
    brandGuardVideoUrl: string | null;
  };
  hero: ConsumerProduct | null;
  ranking: ConsumerProduct[];           // 메인 hero 다음에 노출되는 기본 랭킹 (정수기)
  rankingsByCategory: Record<string, ConsumerProduct[]>; // 카테고리별 랭킹 (탭용)
  picks: ConsumerProduct[];
  banners: ActiveBanner[];
  categories: CategoryEntry[];          // QUICK nav + RankingTabs 재료
  // 메인 페이지 캐시백 띠 자동 노출 — displayConfig.flagshipBannerEnabled (default true).
  flagshipBannerEnabled: boolean;
  // hero 캐러셀의 자동 상품 슬라이드 — displayConfig.heroAutoSlidesEnabled (default true).
  // false 면 협력점이 등록한 DB 배너만 노출.
  heroAutoSlidesEnabled: boolean;
  // 실시간 접수 현황 띠배너용 데이터 (본사 admin 등록).
  liveActivities: LiveActivityItem[];
  // 최근 후기 (메인 페이지 캐러셀 노출용).
  reviews: ReviewListItem[];
};

// 안마의자(massage)/건조기(dryer)는 일시 비활성 — 컨슈머 노출 안 함.
// 추후 활성화 시 아래 주석 풀면 됨 (DB 데이터는 그대로 보존).
const CATEGORY_META: Record<string, { label: string; icon: string; rankPriority: number }> = {
  water:    { label: "정수기",     icon: "💧", rankPriority: 1 },
  air:      { label: "공기청정기", icon: "💨", rankPriority: 2 },
  bidet:    { label: "비데",       icon: "🚿", rankPriority: 3 },
  mattress: { label: "매트리스",   icon: "🛏",  rankPriority: 4 },
  // massage:  { label: "안마의자",   icon: "💆", rankPriority: 5 },
  // dryer:    { label: "건조기",     icon: "🌬", rankPriority: 6 },
  kitchen:  { label: "주방가전",   icon: "🍳", rankPriority: 7 },
};

export async function getPartnerSite(
  partnerCode: string,
  opts?: { sellerCode?: string },
): Promise<PartnerSiteData | null> {
  const partner = await prisma.partner.findUnique({
    where: { partnerCode },
  });
  if (!partner || partner.status !== "active") return null;

  const [products, tierMargin] = await Promise.all([
    prisma.product.findMany({
      where: { status: "active" },
      include: {
        partnerPolicies: { where: { partnerId: partnerCode } },
        hqPolicies: true,
      },
      orderBy: [{ isFeatured: "desc" }, { rentalPrice: "asc" }],
    }),
    prisma.hqMarginByTier.findUnique({ where: { tier: partner.tier } }),
  ]);
  const tierMarginConfig = tierMargin
    ? { type: tierMargin.marginType as "fixed" | "percent", amount: tierMargin.marginAmount, percent: tierMargin.marginPercent }
    : null;

  // 영업자 컨텍스트 — sellerCode 가 주어지면 sellerMargin 산식을 렌탈지원금 cap 에 추가 적용.
  // 본사-협력점(baseCommission − hqMargin = partnerCommission) 과
  // 협력점-영업자(partnerCommission − sellerMargin) 가 같은 산식 구조.
  const sellerMarginPartner = opts?.sellerCode ? partner : null;
  const sellerMarginPolicies = opts?.sellerCode
    ? products.flatMap(p => p.partnerPolicies.map(pp => ({
        productId: p.id,
        sellerMarginAmount: pp.sellerMarginAmount ?? null,
        sellerMarginPercent: pp.sellerMarginPercent ?? null,
      })))
    : undefined;

  // 정렬용 영업점수수료 (= 본사수수료 − 본사마진) — 대표 옵션 기준
  const partnerCommissionByCode = new Map<string, number>();
  for (const p of products) {
    const rep = pickRepresentativeHqPolicy(p);
    const base = rep ? rep.baseCommission + rep.monthIncentive : 0;
    const hqMargin = rep ? computeHqMargin(base, rep, tierMarginConfig) : 0;
    partnerCommissionByCode.set(p.productCode, base - hqMargin);
  }

  // 신규 판정 기준 — Product.createdAt 이 최근 14일 이내면 isNew=true.
  // 자동 산출 영역(picks/ranking)에서 카테고리 맨 앞에 강제 배치 (신규 상품 등록 시 즉시 노출).
  const FRESHNESS_MS = 14 * 24 * 60 * 60 * 1000;
  const NOW_MS = Date.now();

  const all: ConsumerProduct[] = products.map(p => {
    const policy = p.partnerPolicies[0];
    const gift = policy?.giftAmount ?? 0;
    const install = policy?.installAmount ?? 0;
    // 메인 페이지 카드 — priceMatrix 의 최저가 옵션을 표시 (없으면 단일 가격 fallback)
    const lowest = pickLowestPrice(p.priceMatrix, {
      rentalPrice: p.rentalPrice,
      cardDiscountPrice: p.cardDiscountPrice,
      baseRentalPrice: p.baseRentalPrice,
      promoRentalPrice: p.promoRentalPrice,
    });
    const rival = bestRivalPrice(p.priceMatrix);
    return {
      productCode: p.productCode,
      category: p.category,
      name: p.name,
      modelName: p.modelName,
      rentalPrice: lowest.rentalPrice,
      baseRentalPrice: lowest.baseRentalPrice,
      promoApplied: lowest.promoApplied,
      cardDiscountPrice: effectiveCardDiscount(lowest.rentalPrice, lowest.cardDiscountPrice),
      contractPeriod: p.contractPeriod,
      managementType: p.managementType,
      isFeatured: p.isFeatured,
      imageUrl: pickThumbnail(p),
      isNew: NOW_MS - p.createdAt.getTime() < FRESHNESS_MS,
      giftAmount: gift,
      giftLabel: policy?.giftLabel ?? null,
      installFreed: install > 0,
      maxRentalSupport: computeMaxRentalSupport({
        hqPolicies: p.hqPolicies,
        tierMargin: tierMarginConfig,
        partnerSupportAmount: partner.rentalSupportAmount,
        // 브랜드 안전모드 + 컨슈머 메인 → 차단. 영업자 페이지(sellerCode 있음) 만 풀 노출.
        rentalSupportEnabled: effectiveRentalSupportEnabled(partner, opts?.sellerCode),
        giftAmount: gift,
        installAmount: install,
        sellerMarginPartner,
        sellerMarginPolicies,
        productId: p.id,
      }),
      maxRivalSavings: maxRivalSavings(p.priceMatrix),
      minRivalPrice: rival?.monthly ?? null,
      rivalHalfMonths: rival?.halfMonths ?? 0,
      rivalHalfPrice: rival && rival.halfMonths > 0 ? rival.halfMonthly : null,
      lowestMode: lowest.mode,
    };
  });

  // displayConfig 우선 적용 (협력점 직접 진열 편집 — 룰북 26.1)
  const displayConfig = (partner.displayConfig as { picks?: string[]; ranking?: Record<string, string[]> } | null) ?? null;
  const codeMap = new Map(all.map(p => [p.productCode, p]));
  const pickByCodes = (codes: string[] | undefined): ConsumerProduct[] =>
    Array.isArray(codes)
      ? codes.map(c => codeMap.get(c)).filter((p): p is ConsumerProduct => !!p)
      : [];

  // 정렬 헬퍼 — 신규 우선, 그 다음 영업점수수료(= 본사수수료 − 본사마진) 높은 순.
  // 신규(isNew=true) 상품은 createdAt 기준 14일 이내 — 자동 산출 영역에서 항상 앞에 배치.
  const commissionDesc = (a: ConsumerProduct, b: ConsumerProduct) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return (partnerCommissionByCode.get(b.productCode) ?? 0) - (partnerCommissionByCode.get(a.productCode) ?? 0);
  };

  // Hero = displayConfig.picks[0] 우선, 없으면 영업점수수료 높은 순 fallback
  const customPicks = pickByCodes(displayConfig?.picks);
  const sortedByCommission = [...all].sort(commissionDesc);
  const hero =
    customPicks[0] ??
    sortedByCommission.find(p => p.isFeatured) ??
    sortedByCommission[0] ??
    null;

  // 카테고리별 랭킹 (탭용) — displayConfig.ranking[cat] 우선, 없으면 영업점수수료 높은 순 fallback.
  // 단, 카테고리에 반값(rivalHalfMonths>0) 모델이 있고 top 3 에 하나도 없으면
  // 4번째 자리에 가장 수수료 높은 반값 모델 1건을 강제 삽입 — 반값 매리트가 메인에 노출되도록.
  const rankingsByCategory: Record<string, ConsumerProduct[]> = {};
  for (const cat of Object.keys(CATEGORY_META)) {
    const custom = pickByCodes(displayConfig?.ranking?.[cat]);
    if (custom.length > 0) {
      rankingsByCategory[cat] = custom.slice(0, 6);
      continue;
    }
    const sorted = all.filter(p => p.category === cat).sort(commissionDesc);
    if (sorted.length === 0) continue;
    const top3 = sorted.slice(0, 3);
    const top3HasHalf = top3.some(p => p.rivalHalfMonths > 0);
    const topHalf = sorted.find(p => p.rivalHalfMonths > 0 && !top3.some(t => t.productCode === p.productCode));
    if (!top3HasHalf && topHalf) {
      // top3 + 반값모델 1건 + 나머지 (반값모델 제외) 채우기
      const rest = sorted.slice(3).filter(p => p.productCode !== topHalf.productCode);
      rankingsByCategory[cat] = [...top3, topHalf, ...rest].slice(0, 6);
    } else {
      rankingsByCategory[cat] = sorted.slice(0, 6);
    }
  }
  const ranking = rankingsByCategory.water ?? sortedByCommission.slice(0, 4);

  // QUICK / Tabs용 카테고리 목록 — 활성 상품 1개 이상인 카테고리만
  const countByCategory = new Map<string, number>();
  for (const p of all) countByCategory.set(p.category, (countByCategory.get(p.category) ?? 0) + 1);
  const categories: CategoryEntry[] = Object.entries(CATEGORY_META)
    .filter(([slug]) => (countByCategory.get(slug) ?? 0) > 0)
    .map(([slug, meta]) => ({
      slug,
      label: meta.label,
      icon: meta.icon,
      count: countByCategory.get(slug) ?? 0,
      isHot: slug === "water" || slug === "air",
    }))
    .sort((a, b) => CATEGORY_META[a.slug].rankPriority - CATEGORY_META[b.slug].rankPriority);

  // 점장 추천 picks: displayConfig.picks 우선 (hero 다음 항목들), 없으면 영업점수수료 높은 순 자동 산출.
  // 반값(rivalHalfMonths>0) 모델이 있는데 top picks 에 하나도 없으면 1건 강제 삽입.
  let picks: ConsumerProduct[];
  if (customPicks.length > 1) {
    picks = customPicks.slice(1, 5);
  } else {
    const candidate = sortedByCommission.filter(p => p.productCode !== hero?.productCode);
    const top4 = candidate.slice(0, 4);
    const top4HasHalf = top4.some(p => p.rivalHalfMonths > 0);
    const topHalf = candidate.find(p => p.rivalHalfMonths > 0 && !top4.some(t => t.productCode === p.productCode));
    if (!top4HasHalf && topHalf) {
      picks = [...top4.slice(0, 3), topHalf];
    } else {
      picks = top4;
    }
  }

  // Active banners — status=active이고 현재 시각이 [startsAt, endsAt] 사이.
  // 본사 공통 배너(scope=global)와 협력점 자기 배너(scope=partner, partnerId 매칭) 둘 다.
  // 협력점이 본인 사이트에서 숨김 처리한 global 배너 ID 는 제외 (opt-out).
  const hiddenGlobalIds = ((partner.displayConfig as { hiddenGlobalBannerIds?: string[] } | null)?.hiddenGlobalBannerIds ?? [])
    .filter((id): id is string => typeof id === "string");
  const now = new Date();
  const bannerRows = await prisma.banner.findMany({
    where: {
      status: "active",
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [
        { scope: "partner", partnerId: partnerCode },
        hiddenGlobalIds.length > 0
          ? { scope: "global", NOT: { id: { in: hiddenGlobalIds } } }
          : { scope: "global" },
      ],
    },
    orderBy: [{ priority: "desc" }, { startsAt: "asc" }],
    take: 8,
  });

  // product-spotlight 레이아웃용 — 강조 상품의 이미지 미리 조회
  const spotlightCodes = bannerRows.map(b => b.spotlightProductCode).filter((c): c is string => !!c);
  const spotlightProducts = spotlightCodes.length > 0
    ? await prisma.product.findMany({
        where: { productCode: { in: spotlightCodes } },
        select: { productCode: true, imageUrl: true, imageUrls: true },
      })
    : [];
  const spotlightImageMap = new Map(spotlightProducts.map(p => [p.productCode, pickThumbnail(p)]));

  const banners: ActiveBanner[] = bannerRows.map(b => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    bgColor1: b.bgColor1,
    bgColor2: b.bgColor2,
    textColor: b.textColor,
    ctaLabel: b.ctaLabel,
    // global 배너는 ctaHref 에 {partnerCode} 플레이스홀더 사용 시 현재 협력점 코드로 치환 (결정 3=c).
    ctaHref: b.ctaHref ? b.ctaHref.replace(/\{partnerCode\}/g, partnerCode) : null,
    endsAt: b.endsAt.toISOString(),
    layout: (b.layout as ActiveBanner["layout"]) ?? "classic",
    spotlightProductCode: b.spotlightProductCode,
    spotlightProductImage: b.spotlightProductCode ? (spotlightImageMap.get(b.spotlightProductCode) ?? null) : null,
    stampText: b.stampText,
    htmlContent: b.htmlContent ? sanitizeBannerHtml(b.htmlContent) : null,
  }));

  // 실시간 접수 현황 (본사 admin 등록 데모 데이터) — 모든 협력점 공통
  const liveActivities = await prisma.liveActivity.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 12,
    select: { id: true, customerName: true, productName: true, region: true, status: true, minutesAgo: true },
  });

  // 최근 후기 (협력점 자체 + 본사 공통) — 캐러셀용 최대 6건
  const reviewRows = await prisma.review.findMany({
    where: {
      status: "published",
      approvalStatus: "approved",
      OR: [{ partnerId: partner.partnerCode }, { partnerId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { product: { select: { name: true, modelName: true } } },
  });
  const nowMs = Date.now();
  const reviews: ReviewListItem[] = reviewRows.map(r => ({
    id: r.id,
    customerName: r.customerName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    productName: r.product?.name ?? null,
    modelName: r.product?.modelName ?? null,
    region: r.region,
    isVerified: r.isVerified,
    installPhotoUrl: r.installPhotoUrl,
    photos: r.photos ?? [],
    daysAgo: Math.max(0, Math.floor((nowMs - r.createdAt.getTime()) / (1000 * 60 * 60 * 24))),
  }));

  return {
    partner: {
      partnerCode: partner.partnerCode,
      // 본사 정책: 컨슈머 사이트에서는 모든 협력점을 "SK매직 인증파트너점" 단일 브랜드로 노출
      partnerName: CONSUMER_BRAND_NAME,
      brandLabel: CONSUMER_BRAND_NAME,
      // 푸터 "상호" 표기 — 협력점 row 의 raw partnerName (법인/상호 원본)
      companyName: partner.partnerName,
      region: partner.region,
      address: partner.address,
      businessNumber: partner.businessNumber,
      commerceNumber: partner.commerceNumber,
      hotlineNumber: partner.hotlineNumber,
      kakaoChannelUrl: partner.kakaoChannelUrl,
      ownerName: partner.ownerName,
      csHours: partner.csHours,
      csLunchHours: partner.csLunchHours,
      csHolidays: partner.csHolidays,
      footerLogoUrl: partner.footerLogoUrl,
      brandGuardVideoUrl: effectiveBrandGuardUrl(partner, opts?.sellerCode),
    },
    hero,
    ranking,
    rankingsByCategory,
    picks,
    banners,
    categories,
    flagshipBannerEnabled: (() => {
      const cfg = partner.displayConfig as { flagshipBannerEnabled?: boolean } | null;
      return cfg?.flagshipBannerEnabled !== false; // 명시적 false 일 때만 끔
    })(),
    heroAutoSlidesEnabled: (() => {
      const cfg = partner.displayConfig as { heroAutoSlidesEnabled?: boolean } | null;
      return cfg?.heroAutoSlidesEnabled !== false; // 명시적 false 일 때만 끔
    })(),
    liveActivities,
    reviews,
  };
}

export async function listPartnerProducts(
  partnerCode: string,
  opts: { category?: string } = {}
): Promise<ConsumerProduct[]> {
  const [partner, products] = await Promise.all([
    prisma.partner.findUnique({
      where: { partnerCode },
      select: { tier: true, displayConfig: true, rentalSupportAmount: true, rentalSupportEnabled: true, brandSafeMode: true },
    }),
    prisma.product.findMany({
      where: {
        status: "active",
        ...(opts.category && { category: opts.category }),
      },
      include: {
        partnerPolicies: { where: { partnerId: partnerCode } },
        hqPolicies: true,
      },
    }),
  ]);
  const tierMargin = partner ? await prisma.hqMarginByTier.findUnique({ where: { tier: partner.tier } }) : null;
  const tierMarginConfig = tierMargin
    ? { type: tierMargin.marginType as "fixed" | "percent", amount: tierMargin.marginAmount, percent: tierMargin.marginPercent }
    : null;

  const partnerCommissionByCode = new Map<string, number>();
  for (const p of products) {
    const rep = pickRepresentativeHqPolicy(p);
    const base = rep ? rep.baseCommission + rep.monthIncentive : 0;
    const hqMargin = rep ? computeHqMargin(base, rep, tierMarginConfig) : 0;
    partnerCommissionByCode.set(p.productCode, base - hqMargin);
  }

  const mapped: ConsumerProduct[] = products.map(p => {
    const policy = p.partnerPolicies[0];
    const gift = policy?.giftAmount ?? 0;
    const install = policy?.installAmount ?? 0;
    const lowest = pickLowestPrice(p.priceMatrix, {
      rentalPrice: p.rentalPrice,
      cardDiscountPrice: p.cardDiscountPrice,
      baseRentalPrice: p.baseRentalPrice,
      promoRentalPrice: p.promoRentalPrice,
    });
    const rival = bestRivalPrice(p.priceMatrix);
    return {
      productCode: p.productCode,
      category: p.category,
      name: p.name,
      modelName: p.modelName,
      rentalPrice: lowest.rentalPrice,
      baseRentalPrice: lowest.baseRentalPrice,
      promoApplied: lowest.promoApplied,
      cardDiscountPrice: effectiveCardDiscount(lowest.rentalPrice, lowest.cardDiscountPrice),
      contractPeriod: p.contractPeriod,
      managementType: p.managementType,
      isFeatured: p.isFeatured,
      imageUrl: pickThumbnail(p),
      isNew: Date.now() - p.createdAt.getTime() < 14 * 24 * 60 * 60 * 1000,
      giftAmount: gift,
      giftLabel: policy?.giftLabel ?? null,
      installFreed: install > 0,
      // listPartnerProducts 는 카테고리/리스트 페이지용 (sellerCode 컨텍스트 없음) → 브랜드 안전모드 동일 차단.
      maxRentalSupport: partner ? computeMaxRentalSupport({
        hqPolicies: p.hqPolicies,
        tierMargin: tierMarginConfig,
        partnerSupportAmount: partner.rentalSupportAmount,
        rentalSupportEnabled: effectiveRentalSupportEnabled(partner, undefined),
        giftAmount: gift,
        installAmount: install,
      }) : 0,
      maxRivalSavings: maxRivalSavings(p.priceMatrix),
      minRivalPrice: rival?.monthly ?? null,
      rivalHalfMonths: rival?.halfMonths ?? 0,
      rivalHalfPrice: rival && rival.halfMonths > 0 ? rival.halfMonthly : null,
      lowestMode: lowest.mode,
    };
  });

  // displayConfig.ranking[cat] override 우선
  const displayConfig = (partner?.displayConfig as { ranking?: Record<string, string[]> } | null) ?? null;
  const codeMap = new Map(mapped.map(p => [p.productCode, p]));

  // 모든 영역 동일: 신규 우선 → 영업점수수료(= 본사수수료 − 본사마진) 높은 순 fallback.
  // 신규 상품(createdAt 14일 이내)이 카테고리 리스트 최상단에 노출되도록.
  const commissionDesc = (a: ConsumerProduct, b: ConsumerProduct) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return (partnerCommissionByCode.get(b.productCode) ?? 0) - (partnerCommissionByCode.get(a.productCode) ?? 0);
  };

  if (opts.category) {
    const customCodes = displayConfig?.ranking?.[opts.category];
    if (Array.isArray(customCodes) && customCodes.length > 0) {
      const ordered = customCodes.map(c => codeMap.get(c)).filter((p): p is ConsumerProduct => !!p);
      const orderedSet = new Set(ordered.map(p => p.productCode));
      const rest = mapped.filter(p => !orderedSet.has(p.productCode)).sort(commissionDesc);
      return [...ordered, ...rest];
    }
  }
  return mapped.sort(commissionDesc);
}

export async function getPartnerHeader(partnerCode: string) {
  const partner = await prisma.partner.findUnique({ where: { partnerCode } });
  if (!partner || partner.status !== "active") return null;
  return {
    partnerCode: partner.partnerCode,
    // 본사 정책: 컨슈머 사이트에서는 모든 협력점을 "SK매직 인증파트너점" 단일 브랜드로 노출.
    // 협력점 고유명(인터넷끝판왕 등)은 admin/franchise 콘솔에서만 사용.
    partnerName: CONSUMER_BRAND_NAME,
    brandLabel: CONSUMER_BRAND_NAME,
    // 푸터 "상호" 표기 — 협력점 row 의 raw partnerName (법인/상호 원본)
    companyName: partner.partnerName,
    region: partner.region,
    address: partner.address,
    businessNumber: partner.businessNumber,
    commerceNumber: partner.commerceNumber,
    hotlineNumber: partner.hotlineNumber,
    kakaoChannelUrl: partner.kakaoChannelUrl,
    ownerName: partner.ownerName,
    csHours: partner.csHours,
    csLunchHours: partner.csLunchHours,
    csHolidays: partner.csHolidays,
    footerLogoUrl: partner.footerLogoUrl,
    brandGuardVideoUrl: partner.brandGuardVideoUrl,
  };
}

export async function listActivePartners(): Promise<{
  partnerCode: string;
  partnerName: string;
  brandLabel: string;
  region: string | null;
}[]> {
  const partners = await prisma.partner.findMany({
    where: { status: "active" },
    select: { partnerCode: true, partnerName: true, brandLabel: true, region: true },
    orderBy: { createdAt: "asc" },
  });
  // 컨슈머 사이트에서는 모든 협력점을 단일 브랜드로 노출 (협력점 식별은 URL/지역으로)
  return partners.map(p => ({
    partnerCode: p.partnerCode,
    partnerName: CONSUMER_BRAND_NAME,
    brandLabel: CONSUMER_BRAND_NAME,
    region: p.region,
  }));
}

export type PriceOption = {
  mode: "방문형" | "셀프형" | null;
  contractPeriod: number;
  ownershipPeriod: number | null;
  visitInterval: string;
  // 3-tier: basePrice (기준가, 취소선용) → rentalPrice (운영가) → promoPrice (전사할인 판촉가, 있으면)
  basePrice: number | null;
  rentalPrice: number;       // 운영가
  promoPrice: number | null; // 5월 판촉가 (전사할인)
  cardDiscountPrice: number | null; // (promo ?? rental) − 23,000 (매직몰 카드할인 최대)
  baseCommission: number | null;
  // 협력점 실제 commission (= (baseCommission + monthIncentive) − 본사마진, VAT 제외 기준).
  // 메인 카드의 maxRentalSupport 와 동일한 산식으로 server 가 미리 계산해서 전달.
  // PriceConfigurator 의 렌탈지원금 계산은 반드시 이 값을 사용해야 메인 카드와 일치.
  partnerCommission?: number | null;
  // 타사보상 (rival compensation) 가격 — 본사 정책 PDF 별첨 (신규 단품에만 적용)
  // 카드할인은 이 값과 별개로 들어감.
  rivalCompensationPrice?: number | null;
  rivalCompensationHalfPriceMonths?: number | null; // 반값할인 적용 개월수 (없으면 null)
};

export type ReviewItem = {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  selectedMode: string | null;
  selectedContractPeriod: number | null;
  isVerified: boolean;
  daysAgo: number;
  installPhotoUrl: string | null;
  region: string | null;
};
export type ReviewSummary = {
  count: number;
  avgRating: number;        // 평균 (소수 1자리)
  verifiedCount: number;
  top: ReviewItem[];        // 상품 상세 미리보기용 3건
};

export type ProductContentImage = {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

export type ProductDetail = ConsumerProduct & {
  description: string | null;
  cardDiscountSavings: number | null;
  finalAfterCard: number | null;
  imageUrls: string[];
  contentImages: ProductContentImage[];  // 본문 마케팅 이미지 (승인 시 Blob 영구 저장)
  keyFeatures: string[];
  specs: Record<string, string>;
  warrantyMonths: number;
  priceMatrix: PriceOption[];        // 약정/모드별 옵션. 비어있으면 단일 가격만.
  rivalCompensation: {               // 타사보상 (placeholder — 시트 정식 정책 들어오면 여기로)
    enabled: boolean;
    monthlyDiscount: number;
    months: number;
    note: string;
  };
  // 협력점 렌탈지원금 — 옵션별 한도 검증해 표기 (rentalSupport.ts helper 사용)
  partnerRentalSupportAmount: number;
  partnerRentalSupportEnabled: boolean;
  partnerInstallAmount: number;
  reviews: ReviewSummary;
  partner: PartnerSiteData["partner"];
  related: ConsumerProduct[];
};

export async function getPartnerProductDetail(
  partnerCode: string,
  productCode: string,
  opts?: { sellerCode?: string },
): Promise<ProductDetail | null> {
  const partner = await prisma.partner.findUnique({ where: { partnerCode } });
  if (!partner || partner.status !== "active") return null;

  const product = await prisma.product.findUnique({
    where: { productCode },
    include: {
      partnerPolicies: { where: { partnerId: partnerCode } },
      hqPolicies: true,
      contentImages: {
        where: { status: "active" },
        orderBy: { order: "asc" },
        select: { url: true, alt: true, width: true, height: true },
      },
    },
  });
  if (!product || product.status !== "active") return null;

  // partner.tier 기반 본사마진 — 메인 카드의 maxRentalSupport 와 같은 산식 적용을 위해 필요
  const tierMargin = await prisma.hqMarginByTier.findUnique({ where: { tier: partner.tier } });
  const tierMarginConfig = tierMargin
    ? { type: tierMargin.marginType as "fixed" | "percent", amount: tierMargin.marginAmount, percent: tierMargin.marginPercent }
    : null;

  // priceMatrix 옵션 ↔ HqPolicy 매칭 — verify-hq-policy-consistency.ts 와 동일한 키.
  // priceMatrix 의 mode 가 null 이면 product.managementType 으로 fallback.
  const managementTypeToMode = (mt: string): "방문형" | "셀프형" =>
    mt.includes("자가") || mt.includes("셀프") ? "셀프형" : "방문형";
  const productDefaultMode = managementTypeToMode(product.managementType);
  const hqByKey = new Map<string, { baseCommission: number; monthIncentive: number; marginType: string | null; marginAmount: number | null; marginPercent: number | null }>();
  for (const hq of product.hqPolicies) {
    hqByKey.set(`${hq.mode}|${hq.contractPeriod}`, hq);
  }

  const policy = product.partnerPolicies[0];
  const effectiveCard = effectiveCardDiscount(product.rentalPrice, product.cardDiscountPrice);
  const cardDiscountSavings = effectiveCard != null ? product.rentalPrice - effectiveCard : null;

  // priceMatrix 정리 — null 가격 제외 + 카드할인가 정규화 + 3-tier 전달.
  const rawMatrix = (product.priceMatrix as unknown as Array<{
    mode: string | null;
    contractPeriod: number;
    ownershipPeriod: number | null;
    visitInterval: string;
    basePrice?: number | null;
    rentalPrice: number | null;
    promoPrice?: number | null;
    cardDiscountPrice: number | null;
    baseCommission: number | null;
    rivalCompensationPrice?: number | null;
    rivalCompensationHalfPriceMonths?: number | null;
  }> | null) ?? [];
  const priceMatrix: PriceOption[] = rawMatrix
    .filter(r => r.rentalPrice != null && r.rentalPrice > 0)
    .map(r => {
      // effective = promo ?? rental. cardDiscount 는 effective 기준으로 정규화.
      const effective = r.promoPrice ?? (r.rentalPrice as number);
      // partnerCommission — 메인 카드 computeMaxRentalSupport 와 동일 산식.
      //   1) (mode, contractPeriod) 으로 HqPolicy 매칭 (mode null 이면 product.managementType fallback)
      //   2) base = HqPolicy.baseCommission + HqPolicy.monthIncentive (VAT 제외)
      //   3) partnerCommission = base − computeHqMargin(base, hq, tierMargin)
      // 매칭 실패 시 null — UI 측은 렌탈지원금 0 으로 처리 (안전 기본값).
      const optMode = (r.mode === "방문형" || r.mode === "셀프형") ? r.mode : productDefaultMode;
      const hq = hqByKey.get(`${optMode}|${r.contractPeriod}`);
      const baseCommission = hq ? hq.baseCommission + hq.monthIncentive : null;
      const partnerCommissionRaw = (hq && baseCommission != null)
        ? baseCommission - computeHqMargin(baseCommission, hq, tierMarginConfig)
        : null;
      // 영업자 컨텍스트 — partnerCommission 에서 sellerMargin 한 번 더 차감하여 영업자가 줄 수 있는
      // 한도(marginCap) 로 사용. 협력점-영업자 산식이 본사-협력점 산식과 동일한 구조.
      const partnerCommission = (opts?.sellerCode && partnerCommissionRaw != null)
        ? Math.max(0, partnerCommissionRaw - computeSellerMargin(partnerCommissionRaw, partner, policy ?? null))
        : partnerCommissionRaw;
      return {
        mode: (r.mode === "방문형" || r.mode === "셀프형") ? r.mode : null,
        contractPeriod: r.contractPeriod,
        ownershipPeriod: r.ownershipPeriod,
        visitInterval: r.visitInterval,
        basePrice: r.basePrice ?? null,
        rentalPrice: r.rentalPrice as number,
        promoPrice: r.promoPrice ?? null,
        cardDiscountPrice: effectiveCardDiscount(effective, r.cardDiscountPrice),
        baseCommission: r.baseCommission,
        partnerCommission,
        rivalCompensationPrice: r.rivalCompensationPrice ?? null,
        rivalCompensationHalfPriceMonths: r.rivalCompensationHalfPriceMonths ?? null,
      };
    });

  const detailRival = bestRivalPrice(product.priceMatrix);
  const detail: ProductDetail = {
    productCode: product.productCode,
    category: product.category,
    name: product.name,
    modelName: product.modelName,
    // 상세 페이지 헤더는 effective (promo ?? rental) 노출. PriceConfigurator 가 옵션별 정확 계산.
    rentalPrice: product.promoRentalPrice ?? product.rentalPrice,
    baseRentalPrice: product.baseRentalPrice,
    promoApplied: product.promoRentalPrice != null,
    cardDiscountPrice: effectiveCard,
    contractPeriod: product.contractPeriod,
    managementType: product.managementType,
    isFeatured: product.isFeatured,
    imageUrl: pickThumbnail(product),
    isNew: Date.now() - product.createdAt.getTime() < 14 * 24 * 60 * 60 * 1000,
    description: product.description,
    giftAmount: policy?.giftAmount ?? 0,
    giftLabel: policy?.giftLabel ?? null,
    installFreed: (policy?.installAmount ?? 0) > 0,
    maxRentalSupport: 0, // 상품 상세는 PriceConfigurator가 옵션별 정확 계산
    maxRivalSavings: maxRivalSavings(product.priceMatrix),
    minRivalPrice: detailRival?.monthly ?? null,
    rivalHalfMonths: detailRival?.halfMonths ?? 0,
    rivalHalfPrice: detailRival && detailRival.halfMonths > 0 ? detailRival.halfMonthly : null,
    lowestMode: null, // 상세 페이지는 옵션 선택 UI 에서 직접 노출 → 헤더 라벨은 그대로
    partnerRentalSupportAmount: partner.rentalSupportAmount ?? 0,
    // 브랜드 안전모드 + 컨슈머 메인 컨텍스트(sellerCode 없음) → 렌탈지원금 노출 차단.
    // 영업자 페이지 (sellerCode 있음) 에서만 풀 노출. 협력점이 자체 OFF 면 그대로 false.
    partnerRentalSupportEnabled: effectiveRentalSupportEnabled(partner, opts?.sellerCode),
    partnerInstallAmount: policy?.installAmount ?? 0,
    cardDiscountSavings,
    finalAfterCard: effectiveCard,
    priceMatrix,
    rivalCompensation: {
      // 본사 정책 — 신규/단품 정수기에만 적용. priceMatrix.rivalCompensationPrice (모델별)
      // 가 진본. 여기 legacy 일률 정책은 사용하지 않음 (enabled=false).
      enabled: false,
      monthlyDiscount: 0,
      months: 0,
      note: "신규 단품 정수기 한정. 옵션 선택 후 '타사보상 적용' 토글에서 모델별 가격 자동 적용.",
    },
    imageUrls: product.imageUrls ?? [],
    contentImages: (product.contentImages ?? []).map(ci => ({
      url: ci.url, alt: ci.alt, width: ci.width, height: ci.height,
    })),
    keyFeatures: (product.keyFeatures as unknown as string[]) ?? [],
    specs: (product.specs as unknown as Record<string, string>) ?? {},
    warrantyMonths: product.warrantyMonths ?? 60,
    reviews: {
      count: 0,
      avgRating: 0,
      verifiedCount: 0,
      top: [],
    },
    partner: {
      partnerCode: partner.partnerCode,
      // 컨슈머 사이트 단일 브랜드 노출
      partnerName: CONSUMER_BRAND_NAME,
      brandLabel: CONSUMER_BRAND_NAME,
      // 푸터 "상호" 표기 — 협력점 row 의 raw partnerName (법인/상호 원본)
      companyName: partner.partnerName,
      region: partner.region,
      address: partner.address,
      businessNumber: partner.businessNumber,
      commerceNumber: partner.commerceNumber,
      hotlineNumber: partner.hotlineNumber,
      kakaoChannelUrl: partner.kakaoChannelUrl,
      ownerName: partner.ownerName,
      csHours: partner.csHours,
      csLunchHours: partner.csLunchHours,
      csHolidays: partner.csHolidays,
      footerLogoUrl: partner.footerLogoUrl,
      brandGuardVideoUrl: effectiveBrandGuardUrl(partner, opts?.sellerCode),
    },
    related: [],
  };

  // Reviews — 이 상품의 후기. status=published + approvalStatus=approved 만 컨슈머 노출.
  // approvalStatus 의 default 가 'approved' 라 기존 후기는 영향 없음.
  const REVIEW_WHERE = { productId: product.id, status: "published", approvalStatus: "approved" } as const;
  const [reviewCount, reviewAvg, reviewVerified, recentReviews] = await Promise.all([
    prisma.review.count({ where: REVIEW_WHERE }),
    prisma.review.aggregate({ where: REVIEW_WHERE, _avg: { rating: true } }),
    prisma.review.count({ where: { ...REVIEW_WHERE, isVerified: true } }),
    prisma.review.findMany({
      where: REVIEW_WHERE,
      orderBy: [{ isVerified: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
  ]);
  const NOW = Date.now();
  detail.reviews = {
    count: reviewCount,
    avgRating: reviewAvg._avg.rating != null ? Math.round(reviewAvg._avg.rating * 10) / 10 : 0,
    verifiedCount: reviewVerified,
    top: recentReviews.map(r => ({
      id: r.id,
      customerName: r.customerName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      selectedMode: r.selectedMode,
      selectedContractPeriod: r.selectedContractPeriod,
      isVerified: r.isVerified,
      daysAgo: Math.max(0, Math.floor((NOW - r.createdAt.getTime()) / (24 * 60 * 60 * 1000))),
      installPhotoUrl: r.installPhotoUrl,
      region: r.region,
    })),
  };

  // Related products (same category, different code)
  const relatedRows = await prisma.product.findMany({
    where: {
      status: "active",
      category: product.category,
      productCode: { not: productCode },
    },
    include: {
      partnerPolicies: { where: { partnerId: partnerCode } },
      hqPolicies: true,
    },
    take: 4,
    orderBy: [{ isFeatured: "desc" }, { rentalPrice: "asc" }],
  });
  const relatedTierMargin = await prisma.hqMarginByTier.findUnique({ where: { tier: partner.tier } });
  const relatedTierConfig = relatedTierMargin ? {
    type: relatedTierMargin.marginType as "fixed" | "percent",
    amount: relatedTierMargin.marginAmount,
    percent: relatedTierMargin.marginPercent,
  } : null;
  detail.related = relatedRows.map(p => {
    const pp = p.partnerPolicies[0];
    const gift = pp?.giftAmount ?? 0;
    const install = pp?.installAmount ?? 0;
    const lowest = pickLowestPrice(p.priceMatrix, {
      rentalPrice: p.rentalPrice,
      cardDiscountPrice: p.cardDiscountPrice,
      baseRentalPrice: p.baseRentalPrice,
      promoRentalPrice: p.promoRentalPrice,
    });
    const rival = bestRivalPrice(p.priceMatrix);
    return {
      productCode: p.productCode,
      category: p.category,
      name: p.name,
      modelName: p.modelName,
      rentalPrice: lowest.rentalPrice,
      baseRentalPrice: lowest.baseRentalPrice,
      promoApplied: lowest.promoApplied,
      cardDiscountPrice: effectiveCardDiscount(lowest.rentalPrice, lowest.cardDiscountPrice),
      contractPeriod: p.contractPeriod,
      managementType: p.managementType,
      isFeatured: p.isFeatured,
      imageUrl: pickThumbnail(p),
      isNew: Date.now() - p.createdAt.getTime() < 14 * 24 * 60 * 60 * 1000,
      giftAmount: gift,
      giftLabel: pp?.giftLabel ?? null,
      installFreed: install > 0,
      // 관련 상품 (상세 페이지 하단). 같은 sellerCode 컨텍스트 유지 — opts 따라 결정.
      maxRentalSupport: computeMaxRentalSupport({
        hqPolicies: p.hqPolicies,
        tierMargin: relatedTierConfig,
        partnerSupportAmount: partner.rentalSupportAmount,
        rentalSupportEnabled: effectiveRentalSupportEnabled(partner, opts?.sellerCode),
        giftAmount: gift,
        installAmount: install,
      }),
      maxRivalSavings: maxRivalSavings(p.priceMatrix),
      minRivalPrice: rival?.monthly ?? null,
      rivalHalfMonths: rival?.halfMonths ?? 0,
      rivalHalfPrice: rival && rival.halfMonths > 0 ? rival.halfMonthly : null,
      lowestMode: lowest.mode,
    };
  });

  return detail;
}
