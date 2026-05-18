import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductEditForm from "./ProductEditForm";
import ContentImagesPanel from "@/components/super/ContentImagesPanel";

export const metadata = { title: "상품 편집 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const product = await prisma.product.findUnique({
    where: { productCode: code },
    include: {
      hqPolicies: true,
      _count: { select: { partnerPolicies: true } },
      // 본사 admin 은 anomalous 도 다 보여줌
      contentImages: { where: { status: { in: ["active", "anomalous_size"] } }, orderBy: { order: "asc" } },
    },
  });
  if (!product) notFound();
  // Lead count separately (leads reference productCode string, not relational FK)
  const leadCount = await prisma.lead.count({ where: { productCode: product.productCode } });

  // 미리보기 링크용 — 첫 active 협력점. 없으면 미리보기 링크 자체를 숨김.
  const previewPartner = await prisma.partner.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
    select: { partnerCode: true, partnerName: true },
  });

  const contentImageRows = product.contentImages.map(ci => ({
    id: ci.id, url: ci.url, sourceUrl: ci.sourceUrl, order: ci.order,
    sizeBytes: ci.sizeBytes, width: ci.width, height: ci.height,
    status: ci.status, downloadedAt: ci.downloadedAt.toISOString(),
  }));

  const initial = {
    productCode: product.productCode,
    category: product.category,
    name: product.name,
    modelName: product.modelName,
    rentalPrice: product.rentalPrice,
    cardDiscountPrice: product.cardDiscountPrice,
    contractPeriod: product.contractPeriod,
    warrantyMonths: product.warrantyMonths,
    managementType: product.managementType,
    description: product.description ?? "",
    imageUrls: product.imageUrls,
    keyFeatures: (product.keyFeatures as unknown as string[]) ?? [],
    specs: (product.specs as unknown as Record<string, string>) ?? {},
    isFeatured: product.isFeatured,
    status: product.status as "active" | "discontinued",
    priceMatrix: (product.priceMatrix as unknown as Array<{
      mode: "방문형" | "셀프형" | null;
      contractPeriod: number;
      ownershipPeriod: number | null;
      visitInterval: string;
      rentalPrice: number;
      cardDiscountPrice: number | null;
      baseCommission: number | null;
      rivalCompensationPrice?: number | null;
      rivalCompensationHalfPriceMonths?: number | null;
    }> | null) ?? [],
  };

  return (
    <>
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <Link href="/admin/super/products" className="text-[14px] text-rk-info no-underline">← 상품 마스터</Link>
        <h1 className="text-[20px] font-bold tracking-[-.02em]">{product.name}</h1>
        <span className="font-mono text-[13px] text-rk-faint">{product.productCode}</span>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        본사 상품 마스터 편집 · 변경은 모든 협력점 사이트에 즉시 반영
      </p>

      <div className="grid grid-cols-[1fr_280px] gap-3 mb-3 text-[14px]">
        <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-3">
          <b className="block text-rk-ink mb-1">📌 협력점 영향</b>
          <span className="text-rk-muted">
            {product._count.partnerPolicies}개 협력점이 이 상품에 사은품 정책을 운영 중이며, 누적 lead {leadCount}건이 연결되어 있습니다.
          </span>
        </div>
        {previewPartner ? (
          <Link
            href={`/p/${previewPartner.partnerCode}/products/${product.productCode}`}
            target="_blank"
            className="bg-white border border-rk-line rounded p-3 hover:border-rk-navy no-underline transition-colors"
          >
            <b className="block text-rk-ink">🔗 소비자 화면 미리보기</b>
            <span className="text-rk-muted text-[13px]">{previewPartner.partnerName} 사이트로 새 탭 열기</span>
          </Link>
        ) : (
          <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-3 text-rk-faint text-[13px]">
            미리보기 가능한 활성 협력점이 없습니다.
          </div>
        )}
      </div>

      <ProductEditForm initial={initial} />

      <div className="mt-3">
        <ContentImagesPanel productCode={product.productCode} images={contentImageRows} />
      </div>
    </>
  );
}
