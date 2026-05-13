import { prisma } from "./prisma";

const DAY = 24 * 60 * 60 * 1000;

export type HeroSlideProduct = {
  productCode: string;
  name: string;
  imageUrl: string | null;       // 카드 썸네일 (소형)
  heroImage: string | null;      // 큰 백그라운드/카드용 (ContentImage Blob 또는 원본 갤러리)
  rentalPrice: number;
  cardDiscountPrice: number | null;
  rivalCompensationPrice: number | null;
  rivalHalfMonths: number | null;
  giftLabel: string | null;
  giftAmount: number;
  badge: string;       // "신모델" / "타사보상" / "단독 사은품" / "BEST"
};

export type PartnerHeroData = {
  slides: HeroSlideProduct[];
  kpi: {
    daysOperated: number;
    leadsThisMonth: number;
    avgResponseMinutes: number | null;
    rating: number | null;
    reviewCount: number;
  };
};

const NEW_MODEL_CODES = ["WPUIAC506", "WPUMAC306"]; // 5월 신모델: 메가 아이스 / 투워터

export async function getPartnerHero(partnerCode: string): Promise<PartnerHeroData> {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [partner, newModels, rivalProducts, giftPolicies, leadsThisMonth, recentLogs, reviewAgg, reviewCount] = await Promise.all([
    prisma.partner.findUnique({
      where: { partnerCode },
      select: { createdAt: true },
    }),
    // 신모델 (prefix 매칭) + contentImages 큰 이미지 포함
    prisma.product.findMany({
      where: {
        status: "active",
        OR: NEW_MODEL_CODES.map(prefix => ({ productCode: { startsWith: prefix } })),
      },
      select: {
        productCode: true, name: true, imageUrls: true, imageUrl: true,
        rentalPrice: true, cardDiscountPrice: true, priceMatrix: true,
        contentImages: {
          where: { status: "active" },
          orderBy: { order: "asc" },
          select: { url: true, width: true, height: true },
          take: 5,
        },
      },
      take: 4,
    }),
    // 타사보상 가격 가진 상품 + contentImages
    prisma.product.findMany({
      where: { status: "active" },
      select: {
        productCode: true, name: true, imageUrls: true, imageUrl: true,
        rentalPrice: true, cardDiscountPrice: true, priceMatrix: true, category: true, isFeatured: true,
        contentImages: {
          where: { status: "active" },
          orderBy: { order: "asc" },
          select: { url: true, width: true, height: true },
          take: 5,
        },
      },
    }),
    // 협력점 사은품 정책 (giftAmount 큰 순) + contentImages
    prisma.partnerPolicy.findMany({
      where: { partnerId: partnerCode, giftAmount: { gt: 0 } },
      orderBy: { giftAmount: "desc" },
      take: 4,
      include: {
        product: {
          select: {
            productCode: true, name: true, imageUrls: true, imageUrl: true,
            rentalPrice: true, cardDiscountPrice: true, priceMatrix: true,
            contentImages: {
              where: { status: "active" },
              orderBy: { order: "asc" },
              select: { url: true, width: true, height: true },
              take: 5,
            },
          },
        },
      },
    }),
    prisma.lead.count({ where: { partnerId: partnerCode, createdAt: { gte: monthStart } } }),
    prisma.leadStatusLog.findMany({
      where: {
        lead: { partnerId: partnerCode },
        previousStatus: "consult_wish",
        createdAt: { gte: new Date(Date.now() - 30 * DAY) },
      },
      include: { lead: { select: { createdAt: true } } },
      take: 100,
    }),
    prisma.review.aggregate({
      where: { partnerId: partnerCode, status: "published" },
      _avg: { rating: true },
    }),
    prisma.review.count({ where: { partnerId: partnerCode, status: "published" } }),
  ]);

  // 평균 응답 시간 (consult_wish → 첫 전이까지)
  let avgResponseMinutes: number | null = null;
  const diffs = recentLogs
    .map(l => l.createdAt.getTime() - l.lead.createdAt.getTime())
    .filter(ms => ms > 0);
  if (diffs.length > 0) {
    avgResponseMinutes = Math.round(diffs.reduce((s, n) => s + n, 0) / diffs.length / 60_000);
  }

  // 운영 일수
  const daysOperated = partner
    ? Math.max(1, Math.floor((Date.now() - partner.createdAt.getTime()) / DAY))
    : 0;

  // priceMatrix 안에서 rivalCompensationPrice 가 있는 상품만 필터
  type PriceOpt = { contractPeriod?: number; rivalCompensationPrice?: number | null; rivalCompensationHalfPriceMonths?: number | null };
  const rivalCandidates = rivalProducts
    .map(p => {
      const opts = (p.priceMatrix as unknown as PriceOpt[] | null) ?? [];
      const sixty = opts.find(o => o.contractPeriod === 60 && o.rivalCompensationPrice != null) ?? opts.find(o => o.rivalCompensationPrice != null);
      if (!sixty) return null;
      return { product: p, opt: sixty };
    })
    .filter((x): x is { product: typeof rivalProducts[number]; opt: PriceOpt } => x !== null);

  function pickImage(p: { imageUrls: string[]; imageUrl: string | null }): string | null {
    return p.imageUrls?.[0] ?? p.imageUrl ?? null;
  }

  /** 큰 히어로용 이미지 — ContentImage Blob 우선, 가능하면 가로형, 아니면 가장 큰 첫 이미지 */
  function pickHeroImage(p: {
    contentImages?: Array<{ url: string; width: number | null; height: number | null }>;
    imageUrls?: string[];
    imageUrl?: string | null;
  }): string | null {
    const list = p.contentImages ?? [];
    if (list.length > 0) {
      // 가로형(또는 비율 1:1 가까운) 우선 — 백그라운드 친화
      const landscape = list.find(ci => ci.width && ci.height && ci.width >= ci.height);
      if (landscape) return landscape.url;
      // 너비가 가장 큰 것
      const widest = [...list].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
      if (widest) return widest.url;
      return list[0].url;
    }
    // 폴백: 갤러리 첫 이미지
    return p.imageUrls?.[0] ?? p.imageUrl ?? null;
  }

  function rivalFor(p: { priceMatrix: unknown }): { price: number | null; half: number | null } {
    const opts = (p.priceMatrix as unknown as PriceOpt[] | null) ?? [];
    const sixty = opts.find(o => o.contractPeriod === 60 && o.rivalCompensationPrice != null) ?? opts.find(o => o.rivalCompensationPrice != null);
    return { price: sixty?.rivalCompensationPrice ?? null, half: sixty?.rivalCompensationHalfPriceMonths ?? null };
  }

  const slides: HeroSlideProduct[] = [];

  // 슬라이드 1 — 신모델 (메가 아이스 우선)
  const mega = newModels.find(p => p.productCode.startsWith("WPUIAC506")) ?? newModels[0];
  if (mega) {
    const r = rivalFor(mega);
    slides.push({
      productCode: mega.productCode,
      name: mega.name,
      imageUrl: pickImage(mega),
      heroImage: pickHeroImage(mega),
      rentalPrice: mega.rentalPrice,
      cardDiscountPrice: mega.cardDiscountPrice,
      rivalCompensationPrice: r.price,
      rivalHalfMonths: r.half,
      giftLabel: null,
      giftAmount: 0,
      badge: "5월 신모델",
    });
  }

  // 슬라이드 2 — 다른 신모델 또는 신모델 2번째
  const second = newModels.find(p => p.productCode.startsWith("WPUMAC306")) ?? newModels[1];
  if (second) {
    const r = rivalFor(second);
    slides.push({
      productCode: second.productCode,
      name: second.name,
      imageUrl: pickImage(second),
      heroImage: pickHeroImage(second),
      rentalPrice: second.rentalPrice,
      cardDiscountPrice: second.cardDiscountPrice,
      rivalCompensationPrice: r.price,
      rivalHalfMonths: r.half,
      giftLabel: null,
      giftAmount: 0,
      badge: "5월 신모델",
    });
  }

  // 슬라이드 3 — 타사보상 강조 (메가 아이스 외, rivalCompensationPrice 가 가장 큰 할인폭)
  const usedCodes = new Set(slides.map(s => s.productCode));
  const bestRival = [...rivalCandidates]
    .filter(c => !usedCodes.has(c.product.productCode))
    .map(c => ({ ...c, gap: c.product.rentalPrice - (c.opt.rivalCompensationPrice ?? c.product.rentalPrice) }))
    .sort((a, b) => b.gap - a.gap)[0];
  if (bestRival) {
    slides.push({
      productCode: bestRival.product.productCode,
      name: bestRival.product.name,
      imageUrl: pickImage(bestRival.product),
      heroImage: pickHeroImage(bestRival.product),
      rentalPrice: bestRival.product.rentalPrice,
      cardDiscountPrice: bestRival.product.cardDiscountPrice,
      rivalCompensationPrice: bestRival.opt.rivalCompensationPrice ?? null,
      rivalHalfMonths: bestRival.opt.rivalCompensationHalfPriceMonths ?? null,
      giftLabel: null,
      giftAmount: 0,
      badge: "타사보상 강추",
    });
    usedCodes.add(bestRival.product.productCode);
  }

  // 슬라이드 4 — 단독 사은품 (협력점 partnerPolicy 의 giftAmount 최대)
  const giftBest = giftPolicies.find(g => !usedCodes.has(g.product.productCode));
  if (giftBest) {
    const r = rivalFor(giftBest.product);
    slides.push({
      productCode: giftBest.product.productCode,
      name: giftBest.product.name,
      imageUrl: pickImage(giftBest.product),
      heroImage: pickHeroImage(giftBest.product),
      rentalPrice: giftBest.product.rentalPrice,
      cardDiscountPrice: giftBest.product.cardDiscountPrice,
      rivalCompensationPrice: r.price,
      rivalHalfMonths: r.half,
      giftLabel: giftBest.giftLabel,
      giftAmount: giftBest.giftAmount,
      badge: "단독 사은품",
    });
  }

  // 최소 1개 보장 — 모든 옵션이 비면 가장 isFeatured 한 상품
  if (slides.length === 0) {
    const fallback = rivalProducts.find(p => p.isFeatured) ?? rivalProducts[0];
    if (fallback) {
      slides.push({
        productCode: fallback.productCode,
        name: fallback.name,
        imageUrl: pickImage(fallback),
        heroImage: pickHeroImage(fallback),
        rentalPrice: fallback.rentalPrice,
        cardDiscountPrice: fallback.cardDiscountPrice,
        rivalCompensationPrice: null,
        rivalHalfMonths: null,
        giftLabel: null,
        giftAmount: 0,
        badge: "BEST",
      });
    }
  }

  return {
    slides,
    kpi: {
      daysOperated,
      leadsThisMonth,
      avgResponseMinutes,
      rating: reviewAgg._avg.rating ?? null,
      reviewCount,
    },
  };
}
