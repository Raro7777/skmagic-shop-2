import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — 인증된 사용자(본사·협력점·영업자)는 active 상품 목록을 조회 가능.
//        가입 신청서 작성 시 상품 선택 UI 등 내부 검색 용도.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 60)));

  const where: { status: string; category?: string; OR?: Array<{ name?: { contains: string; mode: "insensitive" }; productCode?: { contains: string; mode: "insensitive" }; modelName?: { contains: string; mode: "insensitive" } }> } = { status: "active" };
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { productCode: { contains: q, mode: "insensitive" } },
      { modelName: { contains: q, mode: "insensitive" } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    take: limit,
    select: {
      productCode: true,
      name: true,
      modelName: true,
      category: true,
      rentalPrice: true,
      cardDiscountPrice: true,
      contractPeriod: true,
      managementType: true,
      isFeatured: true,
    },
  });

  return NextResponse.json({ products, count: products.length });
}

// POST — HQ creates a new product. HqPolicy is auto-created with sensible defaults.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden — 본사 관리자만 등록 가능" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Partial<{
    productCode: string;
    name: string;
    modelName: string;
    category: string;
    rentalPrice: number;
    cardDiscountPrice: number | null;
    contractPeriod: number;
    warrantyMonths: number;
    managementType: string;
    description: string;
    imageUrls: string[];
    keyFeatures: string[];
    specs: Record<string, string>;
    isFeatured: boolean;
    // Initial HqPolicy
    baseCommission: number;
    monthIncentive: number;
    installSubsidy: number;
  }>;

  if (!b.productCode?.trim() || !b.name?.trim() || !b.modelName?.trim() || !b.category?.trim()) {
    return NextResponse.json(
      { error: "필수 항목 누락 (productCode·상품명·모델번호·카테고리)" },
      { status: 400 }
    );
  }
  if (b.rentalPrice == null || b.rentalPrice < 0) {
    return NextResponse.json({ error: "월 렌탈가 필수" }, { status: 400 });
  }
  if (!b.managementType?.trim()) {
    return NextResponse.json({ error: "관리방식 필수" }, { status: 400 });
  }

  const productCode = b.productCode.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(productCode)) {
    return NextResponse.json(
      { error: "productCode는 영문 대문자/숫자/하이픈 3~32자" },
      { status: 400 }
    );
  }

  // Defaults
  const baseCommission = b.baseCommission != null ? Math.max(0, Math.floor(b.baseCommission)) : 30000;
  const monthIncentive = b.monthIncentive != null ? Math.max(0, Math.floor(b.monthIncentive)) : 0;
  const installSubsidy = b.installSubsidy != null ? Math.max(0, Math.floor(b.installSubsidy)) : 30000;

  try {
    const created = await prisma.$transaction(async tx => {
      const product = await tx.product.create({
        data: {
          productCode,
          category: b.category!.trim(),
          name: b.name!.trim().slice(0, 200),
          modelName: b.modelName!.trim().slice(0, 64),
          rentalPrice: Math.floor(b.rentalPrice!),
          cardDiscountPrice: b.cardDiscountPrice != null ? Math.floor(b.cardDiscountPrice) : null,
          contractPeriod: b.contractPeriod != null ? Math.floor(b.contractPeriod) : 60,
          warrantyMonths: b.warrantyMonths != null ? Math.floor(b.warrantyMonths) : 60,
          managementType: b.managementType!.trim().slice(0, 64),
          description: b.description?.slice(0, 8000) ?? null,
          imageUrls: Array.isArray(b.imageUrls) ? b.imageUrls.filter(u => typeof u === "string" && u.trim()).map(u => u.trim().slice(0, 512)).slice(0, 12) : [],
          keyFeatures: Array.isArray(b.keyFeatures) ? b.keyFeatures.filter(f => typeof f === "string" && f.trim()).map(f => f.trim().slice(0, 200)).slice(0, 20) : [],
          specs: b.specs && typeof b.specs === "object" ? sanitizeSpecs(b.specs) : {},
          isFeatured: !!b.isFeatured,
          status: "active",
        },
      });

      await tx.hqPolicy.create({
        data: {
          productId: product.id,
          baseCommission,
          monthIncentive,
          installSubsidy,
        },
      });

      return product;
    });

    return NextResponse.json({
      ok: true,
      product: { productCode: created.productCode, name: created.name },
    });
  } catch (e) {
    const ec = (e as { code?: string }).code;
    if (ec === "P2002") {
      return NextResponse.json({ error: "이미 사용 중인 productCode 입니다." }, { status: 400 });
    }
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}

function sanitizeSpecs(raw: Record<string, unknown>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.trim().slice(0, 64);
    if (key && typeof v === "string") cleaned[key] = v.trim().slice(0, 200);
  }
  return cleaned;
}
