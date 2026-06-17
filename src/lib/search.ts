import { prisma } from "./prisma";
import type { ConsumerProduct } from "./partnerSite";

export async function searchPartnerProducts(
  partnerCode: string,
  query: string,
): Promise<ConsumerProduct[]> {
  const q = query.trim();
  if (!q) return [];

  const [products, promotions] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: "active",
        OR: [
          { name:        { contains: q, mode: "insensitive" } },
          { modelName:   { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { partnerPolicies: { where: { partnerId: partnerCode } } },
      orderBy: [{ isFeatured: "desc" }, { rentalPrice: "asc" }],
      take: 50,
    }),
    prisma.partnerProductPromotion.findMany({
      where: { partnerId: partnerCode, enabled: true },
    }),
  ]);

  const promoNowMs = Date.now();
  const promotionByCode = new Map<string, string>();
  for (const promo of promotions) {
    if (!promo.badgeText.trim()) continue;
    if (promo.startsAt && promo.startsAt.getTime() > promoNowMs) continue;
    if (promo.endsAt && promo.endsAt.getTime() < promoNowMs) continue;
    promotionByCode.set(promo.productCode, promo.badgeText);
  }

  return products.map(p => {
    const policy = p.partnerPolicies[0];
    return {
      productCode: p.productCode,
      category: p.category,
      name: p.name,
      modelName: p.modelName,
      rentalPrice: p.promoRentalPrice ?? p.rentalPrice,
      baseRentalPrice: p.baseRentalPrice,
      promoApplied: p.promoRentalPrice != null,
      cardDiscountPrice: p.cardDiscountPrice,
      contractPeriod: p.contractPeriod,
      managementType: p.managementType,
      isFeatured: p.isFeatured,
      imageUrl: p.imageUrls?.[0] ?? p.imageUrl ?? null,
      isNew: Date.now() - p.createdAt.getTime() < 14 * 24 * 60 * 60 * 1000,
      giftAmount: policy?.giftAmount ?? 0,
      giftLabel: policy?.giftLabel ?? null,
      installFreed: (policy?.installAmount ?? 0) > 0,
      maxRentalSupport: 0,
      maxRivalSavings: 0,
      minRivalPrice: null, // 검색 결과 카드는 메인 배지 표기 없음
      rivalHalfMonths: 0,
      rivalHalfPrice: null,
      lowestMode: null,
      promotionBadge: promotionByCode.get(p.productCode) ?? null,
    };
  });
}

/* ============ Admin global search ============ */
export type AdminSearchHit =
  | { kind: "partner"; partnerCode: string; partnerName: string; brandLabel: string; region: string | null }
  | { kind: "product"; productCode: string; name: string; modelName: string; status: string }
  | { kind: "seller"; id: string; sellerCode: string; partnerCode: string; name: string }
  | { kind: "lead"; id: string; customerName: string; phoneMasked: string; partnerId: string | null; status: string; createdAt: string };

export async function adminSearch(query: string, opts: { partnerId?: string | null }): Promise<AdminSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const hits: AdminSearchHit[] = [];

  // Partners — only HQ can see all
  if (!opts.partnerId) {
    const partners = await prisma.partner.findMany({
      where: {
        OR: [
          { partnerCode: { contains: q, mode: "insensitive" } },
          { partnerName: { contains: q, mode: "insensitive" } },
          { region:      { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    });
    for (const p of partners) {
      hits.push({
        kind: "partner",
        partnerCode: p.partnerCode,
        partnerName: p.partnerName,
        brandLabel: p.brandLabel,
        region: p.region,
      });
    }
  }

  // Products
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { productCode: { contains: q.toUpperCase(), mode: "insensitive" } },
        { name:        { contains: q, mode: "insensitive" } },
        { modelName:   { contains: q, mode: "insensitive" } },
      ],
    },
    take: 5,
  });
  for (const p of products) {
    hits.push({
      kind: "product",
      productCode: p.productCode,
      name: p.name,
      modelName: p.modelName,
      status: p.status,
    });
  }

  // Sellers (partner_admin: own only)
  const sellers = await prisma.seller.findMany({
    where: {
      ...(opts.partnerId ? { partnerId: opts.partnerId } : {}),
      OR: [
        { sellerCode: { contains: q, mode: "insensitive" } },
        { name:       { contains: q, mode: "insensitive" } },
        { phone:      { contains: q.replace(/\D/g, "") } },
      ],
    },
    take: 5,
  });
  for (const s of sellers) {
    hits.push({
      kind: "seller",
      id: s.id,
      sellerCode: s.sellerCode,
      partnerCode: s.partnerId,
      name: s.name,
    });
  }

  // Leads (search by name or phone digits)
  const phoneDigits = q.replace(/\D/g, "");
  const leads = await prisma.lead.findMany({
    where: {
      ...(opts.partnerId ? { partnerId: opts.partnerId } : {}),
      OR: [
        { customerName: { contains: q, mode: "insensitive" } },
        ...(phoneDigits.length >= 4 ? [{ phoneRaw: { contains: phoneDigits } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  for (const l of leads) {
    const masked = maskPhone(l.phoneRaw);
    hits.push({
      kind: "lead",
      id: l.id,
      customerName: l.customerName,
      phoneMasked: masked,
      partnerId: l.partnerId,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    });
  }

  return hits;
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length !== 11) return phone;
  return `${d.slice(0, 3)}-${d[3]}***-${d.slice(7)}`;
}
