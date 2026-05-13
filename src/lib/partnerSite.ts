import { prisma } from "@/lib/prisma";

export type ConsumerProduct = {
  productCode: string;
  category: string;
  name: string;
  modelName: string;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  managementType: string;
  isFeatured: boolean;
  imageUrl: string | null;          // 카드용 대표 이미지 (imageUrls[0] 또는 imageUrl)
  // Partner-specific differentiation
  giftAmount: number;
  giftLabel: string | null;
  installFreed: boolean;
};

function pickThumbnail(p: { imageUrl: string | null; imageUrls: string[] }): string | null {
  return p.imageUrls?.[0] ?? p.imageUrl ?? null;
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
  layout: "classic" | "image-bg" | "product-spotlight" | "promo-stamp";
  spotlightProductCode: string | null;
  spotlightProductImage: string | null;
  stampText: string | null;
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

  const products = await prisma.product.findMany({
    where: { status: "active" },
    include: {
      partnerPolicies: { where: { partnerId: partnerCode } },
    },
    orderBy: [{ isFeatured: "desc" }, { rentalPrice: "asc" }],
  });

  const all: ConsumerProduct[] = products.map(p => {
    const policy = p.partnerPolicies[0];
    return {
      productCode: p.productCode,
      category: p.category,
      name: p.name,
      modelName: p.modelName,
      rentalPrice: p.rentalPrice,
      cardDiscountPrice: effectiveCardDiscount(p.rentalPrice, p.cardDiscountPrice),
      contractPeriod: p.contractPeriod,
      managementType: p.managementType,
      isFeatured: p.isFeatured,
      imageUrl: pickThumbnail(p),
      giftAmount: policy?.giftAmount ?? 0,
      giftLabel: policy?.giftLabel ?? null,
      installFreed: (policy?.installAmount ?? 0) > 0,
    };
  });

  // displayConfig 우선 적용 (협력점 직접 진열 편집 — 룰북 26.1)
  const displayConfig = (partner.displayConfig as { picks?: string[]; ranking?: Record<string, string[]> } | null) ?? null;
  const codeMap = new Map(all.map(p => [p.productCode, p]));
  const pickByCodes = (codes: string[] | undefined): ConsumerProduct[] =>
    Array.isArray(codes)
      ? codes.map(c => codeMap.get(c)).filter((p): p is ConsumerProduct => !!p)
      : [];

  // Hero = displayConfig.picks[0] 우선, 없으면 사은품 차별화 자동 산출
  const sortedByGift = [...all].sort((a, b) => b.giftAmount - a.giftAmount);
  const customPicks = pickByCodes(displayConfig?.picks);
  const hero =
    customPicks[0] ??
    sortedByGift.find(p => p.giftAmount > 0) ??
    all.find(p => p.isFeatured) ??
    all[0] ??
    null;

  // 카테고리별 랭킹 (탭용) — displayConfig.ranking[cat] 우선, 없으면 자동 산출
  const rankingsByCategory: Record<string, ConsumerProduct[]> = {};
  for (const cat of Object.keys(CATEGORY_META)) {
    const custom = pickByCodes(displayConfig?.ranking?.[cat]);
    if (custom.length > 0) {
      rankingsByCategory[cat] = custom.slice(0, 6);
    } else {
      const auto = all.filter(p => p.category === cat).slice(0, 6);
      if (auto.length > 0) rankingsByCategory[cat] = auto;
    }
  }
  const ranking = rankingsByCategory.water ?? all.slice(0, 4);

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

  // 점장 추천 picks: displayConfig.picks 우선 (hero 다음 항목들), 없으면 자동 산출
  let picks: ConsumerProduct[];
  if (customPicks.length > 1) {
    picks = customPicks.slice(1, 5);
  } else {
    const picksWithGift = all.filter(p => p.giftAmount > 0 && p.productCode !== hero?.productCode);
    const picksFiller = all.filter(p => !picksWithGift.includes(p) && p.productCode !== hero?.productCode);
    picks = [...picksWithGift, ...picksFiller].slice(0, 4);
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
  }));

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
  const products = await prisma.product.findMany({
    where: {
      status: "active",
      ...(opts.category && { category: opts.category }),
    },
    include: { partnerPolicies: { where: { partnerId: partnerCode } } },
    orderBy: [{ isFeatured: "desc" }, { rentalPrice: "asc" }],
  });
  return products.map(p => {
    const policy = p.partnerPolicies[0];
    return {
      productCode: p.productCode,
      category: p.category,
      name: p.name,
      modelName: p.modelName,
      rentalPrice: p.rentalPrice,
      cardDiscountPrice: effectiveCardDiscount(p.rentalPrice, p.cardDiscountPrice),
      contractPeriod: p.contractPeriod,
      managementType: p.managementType,
      isFeatured: p.isFeatured,
      imageUrl: pickThumbnail(p),
      giftAmount: policy?.giftAmount ?? 0,
      giftLabel: policy?.giftLabel ?? null,
      installFreed: (policy?.installAmount ?? 0) > 0,
    };
  });
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
  rentalPrice: number;
  cardDiscountPrice: number | null;
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

  // priceMatrix 정리 — null 가격 제외 + 카드할인가 정규화 + 타사보상 가격 전달
  const rawMatrix = (product.priceMatrix as unknown as Array<{
    mode: string | null;
    contractPeriod: number;
    ownershipPeriod: number | null;
    visitInterval: string;
    rentalPrice: number | null;
    cardDiscountPrice: number | null;
    baseCommission: number | null;
    rivalCompensationPrice?: number | null;
    rivalCompensationHalfPriceMonths?: number | null;
  }> | null) ?? [];
  const priceMatrix: PriceOption[] = rawMatrix
    .filter(r => r.rentalPrice != null && r.rentalPrice > 0)
    .map(r => ({
      mode: (r.mode === "방문형" || r.mode === "셀프형") ? r.mode : null,
      contractPeriod: r.contractPeriod,
      ownershipPeriod: r.ownershipPeriod,
      visitInterval: r.visitInterval,
      rentalPrice: r.rentalPrice as number,
      cardDiscountPrice: effectiveCardDiscount(r.rentalPrice as number, r.cardDiscountPrice),
      baseCommission: r.baseCommission,
      rivalCompensationPrice: r.rivalCompensationPrice ?? null,
      rivalCompensationHalfPriceMonths: r.rivalCompensationHalfPriceMonths ?? null,
    }));

  const detail: ProductDetail = {
    productCode: product.productCode,
    category: product.category,
    name: product.name,
    modelName: product.modelName,
    rentalPrice: product.rentalPrice,
    cardDiscountPrice: effectiveCard,
    contractPeriod: product.contractPeriod,
    managementType: product.managementType,
    isFeatured: product.isFeatured,
    imageUrl: pickThumbnail(product),
    description: product.description,
    giftAmount: policy?.giftAmount ?? 0,
    giftLabel: policy?.giftLabel ?? null,
    installFreed: (policy?.installAmount ?? 0) > 0,
    partnerRentalSupportAmount: partner.rentalSupportAmount ?? 0,
    partnerRentalSupportEnabled: partner.rentalSupportEnabled ?? true,
    partnerInstallAmount: policy?.installAmount ?? 0,
    cardDiscountSavings,
    finalAfterCard: effectiveCard,
    priceMatrix,
    rivalCompensation: {
      // placeholder: 본사 시트에 명시되지 않아 일률 정책 가정. 시트 정식 정책이 들어오면 갱신.
      enabled: true,
      monthlyDiscount: 5000,
      months: 12,
      note: "타사 가전 보유 시 첫 12개월 월 5,000원 추가 할인 (본사 사전 약정 가정)",
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

  // Reviews — 이 상품의 후기 (최신 published 우선, 협력점 무관 모두 합산)
  const [reviewCount, reviewAvg, reviewVerified, recentReviews] = await Promise.all([
    prisma.review.count({ where: { productId: product.id, status: "published" } }),
    prisma.review.aggregate({ where: { productId: product.id, status: "published" }, _avg: { rating: true } }),
    prisma.review.count({ where: { productId: product.id, status: "published", isVerified: true } }),
    prisma.review.findMany({
      where: { productId: product.id, status: "published" },
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
    })),
  };

  // Related products (same category, different code)
  const relatedRows = await prisma.product.findMany({
    where: {
      status: "active",
      category: product.category,
      productCode: { not: productCode },
    },
    include: { partnerPolicies: { where: { partnerId: partnerCode } } },
    take: 4,
    orderBy: [{ isFeatured: "desc" }, { rentalPrice: "asc" }],
  });
  detail.related = relatedRows.map(p => {
    const pp = p.partnerPolicies[0];
    return {
      productCode: p.productCode,
      category: p.category,
      name: p.name,
      modelName: p.modelName,
      rentalPrice: p.rentalPrice,
      cardDiscountPrice: effectiveCardDiscount(p.rentalPrice, p.cardDiscountPrice),
      contractPeriod: p.contractPeriod,
      managementType: p.managementType,
      isFeatured: p.isFeatured,
      imageUrl: pickThumbnail(p),
      giftAmount: pp?.giftAmount ?? 0,
      giftLabel: pp?.giftLabel ?? null,
      installFreed: (pp?.installAmount ?? 0) > 0,
    };
  });

  return detail;
}
