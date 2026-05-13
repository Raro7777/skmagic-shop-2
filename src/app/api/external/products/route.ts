import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiPartner, apiHeaders } from "@/lib/apiPartnerAuth";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/external/products
 *   ?category=water|air|bidet|mattress|massage|dryer|kitchen
 *   ?limit=20 (default 50, max 200)
 *   ?offset=0
 *
 * 인증: Authorization: Bearer <apiKey> 또는 ?key=<apiKey>
 * 응답: 상품 목록 (가격/사은품/스펙/이미지/약정옵션 모두 포함)
 */
export async function GET(req: Request) {
  // 외부 API는 IP당 분당 60회 (협력점 1곳당 비스움)
  const rl = rateLimit(req, "external:products", { windowMs: 60_000, max: 60 });
  if (!rl.ok) {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests", retryAfter: rl.retryAfterSec }),
      { status: 429, headers: { ...apiHeaders(), "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const partner = await authenticateApiPartner(req);
  if (!partner) {
    return new NextResponse(
      JSON.stringify({ error: "Unauthorized — Authorization: Bearer <apiKey> 필요" }),
      { status: 401, headers: apiHeaders() },
    );
  }

  const url = new URL(req.url);
  const categoryParam = url.searchParams.get("category");
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50") || 50));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0") || 0);

  // ApiPartner.allowedCategories 검사
  if (categoryParam && partner.allowedCategories.length > 0 && !partner.allowedCategories.includes(categoryParam)) {
    return new NextResponse(
      JSON.stringify({ error: `이 API 키는 카테고리 '${categoryParam}'에 접근 권한이 없습니다.` }),
      { status: 403, headers: apiHeaders() },
    );
  }
  const allowFilter = partner.allowedCategories.length > 0
    ? { category: { in: partner.allowedCategories } }
    : {};

  const where = {
    status: "active",
    ...allowFilter,
    ...(categoryParam && { category: categoryParam }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { hqPolicy: true },
      orderBy: [{ category: "asc" }, { isFeatured: "desc" }, { rentalPrice: "asc" }],
      skip: offset,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  // 통계 카운터
  prisma.apiPartner
    .update({ where: { id: partner.id }, data: { totalProductFetches: { increment: 1 } } })
    .catch(() => { /* noop */ });

  return new NextResponse(
    JSON.stringify({
      partner: { slug: partner.slug, name: partner.name },
      total,
      limit,
      offset,
      products: products.map(p => {
        // cardDiscountPrice >= rentalPrice이면 의미 없는 할인 → null로 정규화
        const card = p.cardDiscountPrice != null && p.cardDiscountPrice < p.rentalPrice
          ? p.cardDiscountPrice
          : null;
        const savings = card != null ? p.rentalPrice - card : null;
        return {
          productCode: p.productCode,
          category: p.category,
          name: p.name,
          modelName: p.modelName,
          imageUrl: p.imageUrls?.[0] ?? p.imageUrl ?? null,
          imageUrls: p.imageUrls ?? [],
          rentalPrice: p.rentalPrice,
          cardDiscountPrice: card,
          cardDiscountSavings: savings,
          contractPeriod: p.contractPeriod,
          managementType: p.managementType,
          warrantyMonths: p.warrantyMonths,
          description: p.description,
          keyFeatures: p.keyFeatures ?? [],
          specs: p.specs ?? {},
          priceMatrix: p.priceMatrix ?? [],  // 약정/모드별 옵션
          isFeatured: p.isFeatured,
          // 정책 (수수료 정보는 외부에 노출하지 않음 — 본사 영업 비밀)
          // 외부 사이트에는 가격/사은품/스펙만 노출
          consultUrl: `https://rentking-next.vercel.app/api/external/leads`, // POST endpoint
        };
      }),
    }),
    { status: 200, headers: apiHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiHeaders() });
}
