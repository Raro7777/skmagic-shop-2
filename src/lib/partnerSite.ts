import { prisma } from "@/lib/prisma";
import { pickRepresentativeHqPolicy } from "@/lib/hqPolicy";
import { computeHqMargin } from "@/lib/marginFlow";
import { rentalSupportFor } from "@/lib/rentalSupport";
import { sanitizeBannerHtml } from "@/lib/sanitizeBannerHtml";

/** 상품의 옵션별 렌탈지원금 중 최대값 계산. enabled=false면 0. */
function computeMaxRentalSupport(args: {
  hqPolicies: Array<{ baseCommission: number; monthIncentive: number; marginType: string | null; marginAmount: number | null; marginPercent: number | null }>;
  tierMargin: { type: "fixed" | "percent"; amount: number; percent: number } | null;
  partnerSupportAmount: number;
  rentalSupportEnabled: boolean;
  giftAmount: number;
  installAmount: number;
}): number {
  if (!args.rentalSupportEnabled || args.partnerSupportAmount <= 0) return 0;
  let max = 0;
  for (const opt of args.hqPolicies) {
    const base = opt.baseCommission + opt.monthIncentive;
    const hqMargin = computeHqMargin(base, opt as never, args.tierMargin);
    const partnerCommission = base - hqMargin;
    const s = rentalSupportFor(partnerCommission, args.partnerSupportAmount, args.giftAmount, args.installAmount);
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
  // 모델에 타사 정책 없으면 null. "🔄 타사+카드 적용시 월 ₩X부터" 표시용.
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

// 타사보상 + 동일옵션 카드할인 + (있으면) 반값 기간까지 반영한 최저 시나리오.
// 적용 순서: rentalPrice → rivalCompensationPrice → 카드할인액 차감.
// 반값 기간(첫 N개월) 은 SK매직 청구 자체가 rival/2 이므로 별도 표기. 카드 추가차감은
// 카드 최소 사용 조건이 있어 반값 기간에 음수 보장이 안 되므로 보수적으로 반값 기준 그대로 노출.
//
// 반환값:
//   monthly      — 반값 기간이 끝난 뒤의 정상 월요금 (rival − cardDelta)
//   halfMonths   — 반값 적용 개월수 (0 이면 반값 정책 없음)
//   halfMonthly  — 반값 기간 월요금 (rival × 0.5, 카드 별도)
// 모델에 타사 정책 없으면 null.
//
// 비교 기준: 반값 정책이 있는 옵션을 우선적으로 채택해 매리트가 노출되도록 함.
// 같은 그룹 내에선 monthly 가 가장 낮은 옵션.
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
    const card = opt.cardDiscountPrice != null ? Number(opt.cardDiscountPrice) : null;
    const cardDelta = card != null && card > 0 && card < rental ? rental - card : 0;
    const halfMonths = Math.max(0, Math.floor(Number(opt.rivalCompensationHalfPriceMonths ?? 0)));
    const monthly = Math.max(0, rival - cardDelta);
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
  layout: "classic" | "image-bg" | "product-spotlight" | "promo-stamp" | "html";
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

export type PartnerSiteData = {
  partner: {
    partnerCode: string;
    partnerName: string;
    brandLabel: string;
    region: string | null;
    address: string | null;
    businessNumber: string | null;
    commerceNumber: string | null;
    hotlineNumber: string;
    kakaoChannelUrl: string | null;
    ownerName: string | null;
  };
  hero: ConsumerProduct | null;
  ranking: ConsumerProduct[];           // 메인 hero 다음에 노출되는 기본 랭킹 (정수기)
  rankingsByCategory: Record<string, ConsumerProduct[]>; // 카테고리별 랭킹 (탭용)
  picks: ConsumerProduct[];
  banners: ActiveBanner[];
  categories: CategoryEntry[];          // QUICK nav + RankingTabs 재료
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

export async function getPartnerSite(partnerCode: string): Promise<PartnerSiteData | null> {
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

  // 정렬용 영업점수수료 (= 본사수수료 − 본사마진) — 대표 옵션 기준
  const partnerCommissionByCode = new Map<string, number>();
  for (const p of products) {
    const rep = pickRepresentativeHqPolicy(p);
    const base = rep ? rep.baseCommission + rep.monthIncentive : 0;
    const hqMargin = rep ? computeHqMargin(base, rep, tierMarginConfig) : 0;
    partnerCommissionByCode.set(p.productCode, base - hqMargin);
  }

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
      giftAmount: gift,
      giftLabel: policy?.giftLabel ?? null,
      installFreed: install > 0,
      maxRentalSupport: computeMaxRentalSupport({
        hqPolicies: p.hqPolicies,
        tierMargin: tierMarginConfig,
        partnerSupportAmount: partner.rentalSupportAmount,
        rentalSupportEnabled: partner.rentalSupportEnabled,
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

  // displayConfig 우선 적용 (협력점 직접 진열 편집 — 룰북 26.1)
  const displayConfig = (partner.displayConfig as { picks?: string[]; ranking?: Record<string, string[]> } | null) ?? null;
  const codeMap = new Map(all.map(p => [p.productCode, p]));
  const pickByCodes = (codes: string[] | undefined): ConsumerProduct[] =>
    Array.isArray(codes)
      ? codes.map(c => codeMap.get(c)).filter((p): p is ConsumerProduct => !!p)
      : [];

  // 정렬 헬퍼 — 모든 영역 동일하게 영업점수수료(= 본사수수료 − 본사마진) 높은 순
  const commissionDesc = (a: ConsumerProduct, b: ConsumerProduct) =>
    (partnerCommissionByCode.get(b.productCode) ?? 0) - (partnerCommissionByCode.get(a.productCode) ?? 0);

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

  // Active banners — status=active이고 현재 시각이 [startsAt, endsAt] 사이
  const now = new Date();
  const bannerRows = await prisma.banner.findMany({
    where: {
      partnerId: partnerCode,
      status: "active",
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: [{ priority: "desc" }, { startsAt: "asc" }],
    take: 5,
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
    ctaHref: b.ctaHref,
    endsAt: b.endsAt.toISOString(),
    layout: (b.layout as ActiveBanner["layout"]) ?? "classic",
    spotlightProductCode: b.spotlightProductCode,
    spotlightProductImage: b.spotlightProductCode ? (spotlightImageMap.get(b.spotlightProductCode) ?? null) : null,
    stampText: b.stampText,
    htmlContent: b.htmlContent ? sanitizeBannerHtml(b.htmlContent) : null,
  }));

  // 본사 공식 캠페인 — 모든 협력점 헤로에 자동 첫 슬라이드로 prepend.
  // 종료일 지나면 자동으로 빠짐.
  const HQ_CAMPAIGN_ENDS = "2026-05-26T23:59:59+09:00";
  if (new Date(HQ_CAMPAIGN_ENDS).getTime() > Date.now()) {
    banners.unshift({
      id: "hq-2026-05-ice-is-magic",
      title: "",
      subtitle: null,
      imageUrl: "/hero/sk-may-campaign.jpg",
      bgColor1: "#2C3A5C",
      bgColor2: "#4A5878",
      textColor: "#FFFFFF",
      ctaLabel: null,
      ctaHref: null,
      endsAt: HQ_CAMPAIGN_ENDS,
      layout: "image-bg",
      spotlightProductCode: null,
      spotlightProductImage: null,
      stampText: null,
      htmlContent: null,
    });
  }

  return {
    partner: {
      partnerCode: partner.partnerCode,
      partnerName: partner.partnerName,
      brandLabel: partner.brandLabel,
      region: partner.region,
      address: partner.address,
      businessNumber: partner.businessNumber,
      commerceNumber: partner.commerceNumber,
      hotlineNumber: partner.hotlineNumber,
      kakaoChannelUrl: partner.kakaoChannelUrl,
      ownerName: partner.ownerName,
    },
    hero,
    ranking,
    rankingsByCategory,
    picks,
    banners,
    categories,
  };
}

export async function listPartnerProducts(
  partnerCode: string,
  opts: { category?: string } = {}
): Promise<ConsumerProduct[]> {
  const [partner, products] = await Promise.all([
    prisma.partner.findUnique({
      where: { partnerCode },
      select: { tier: true, displayConfig: true, rentalSupportAmount: true, rentalSupportEnabled: true },
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
      giftAmount: gift,
      giftLabel: policy?.giftLabel ?? null,
      installFreed: install > 0,
      maxRentalSupport: partner ? computeMaxRentalSupport({
        hqPolicies: p.hqPolicies,
        tierMargin: tierMarginConfig,
        partnerSupportAmount: partner.rentalSupportAmount,
        rentalSupportEnabled: partner.rentalSupportEnabled,
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

  // 모든 영역 동일: 영업점수수료(= 본사수수료 − 본사마진) 높은 순 fallback
  const commissionDesc = (a: ConsumerProduct, b: ConsumerProduct) =>
    (partnerCommissionByCode.get(b.productCode) ?? 0) - (partnerCommissionByCode.get(a.productCode) ?? 0);

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
    partnerName: partner.partnerName,
    brandLabel: partner.brandLabel,
    region: partner.region,
    address: partner.address,
    businessNumber: partner.businessNumber,
    commerceNumber: partner.commerceNumber,
    hotlineNumber: partner.hotlineNumber,
    kakaoChannelUrl: partner.kakaoChannelUrl,
    ownerName: partner.ownerName,
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
  return partners;
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
  cardDiscountPrice: number | null; // (promo ?? rental) − 15,000
  baseCommission: number | null;
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
  productCode: string
): Promise<ProductDetail | null> {
  const partner = await prisma.partner.findUnique({ where: { partnerCode } });
  if (!partner || partner.status !== "active") return null;

  const product = await prisma.product.findUnique({
    where: { productCode },
    include: {
      partnerPolicies: { where: { partnerId: partnerCode } },
      contentImages: {
        where: { status: "active" },
        orderBy: { order: "asc" },
        select: { url: true, alt: true, width: true, height: true },
      },
    },
  });
  if (!product || product.status !== "active") return null;

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
    partnerRentalSupportEnabled: partner.rentalSupportEnabled ?? true,
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
      partnerName: partner.partnerName,
      brandLabel: partner.brandLabel,
      region: partner.region,
      address: partner.address,
      businessNumber: partner.businessNumber,
      commerceNumber: partner.commerceNumber,
      hotlineNumber: partner.hotlineNumber,
      kakaoChannelUrl: partner.kakaoChannelUrl,
      ownerName: partner.ownerName,
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
      giftAmount: gift,
      giftLabel: pp?.giftLabel ?? null,
      installFreed: install > 0,
      maxRentalSupport: computeMaxRentalSupport({
        hqPolicies: p.hqPolicies,
        tierMargin: relatedTierConfig,
        partnerSupportAmount: partner.rentalSupportAmount,
        rentalSupportEnabled: partner.rentalSupportEnabled,
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
