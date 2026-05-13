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
      hqPolicy: true,
      _count: { select: { partnerPolicies: true } },
      // 본사 admin 은 anomalous 도 다 보여줌
      contentImages: { where: { status: { in: ["active", "anomalous_size"] } }, orderBy: { order: "asc" } },
    },
  });
  if (!product) notFound();
  // Lead count separately (leads reference productCode string, not relational FK)
  const leadCount = await prisma.lead.count({ where: { productCode: product.productCode } });

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
        <Link
          href={`/p/gangnam-skmagic/products/${product.productCode}`}
          target="_blank"
          className="bg-white border border-rk-line rounded p-3 hover:border-rk-navy no-underline transition-colors"
        >
          <b className="block text-rk-ink">🔗 소비자 화면 미리보기</b>
          <span className="text-rk-muted text-[13px]">강남센터 SK매직 사이트로 새 탭 열기</span>
        </Link>
      </div>

      <ProductEditForm initial={initial} />

      <div className="mt-3">
        <ContentImagesPanel productCode={product.productCode} images={contentImageRows} />
      </div>
    </>
  );
}
