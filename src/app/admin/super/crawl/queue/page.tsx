import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CrawlReviewQueue, { type QueueCard, type DiffRow } from "@/components/super/CrawlReviewQueue";

export const metadata = { title: "크롤 검토 대기 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmt = (d: Date) =>
  `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
function pad(n: number) { return n < 10 ? "0" + n : String(n); }

const FIELD_LABELS: Record<string, string> = {
  name: "상품명",
  modelName: "모델명",
  category: "카테고리",
  rentalPrice: "월 렌탈료",
  cardDiscountPrice: "카드할인가",
  contractPeriod: "약정기간",
  managementType: "관리방식",
  description: "설명",
};

const formatVal = (field: string, v: unknown): string => {
  if (v == null) return "";
  if (field === "rentalPrice" || field === "cardDiscountPrice") {
    return `₩${Number(v).toLocaleString()}`;
  }
  if (field === "contractPeriod") {
    return `${v}개월`;
  }
  return String(v);
};

export default async function CrawlQueuePage() {
  const queue = await prisma.crawledProduct.findMany({
    where: { approvalStatus: "pending" },
    orderBy: [{ changeType: "asc" }, { crawledAt: "desc" }],
    take: 80,
    include: { source: { select: { name: true } } },
  });

  const cards: QueueCard[] = queue.map(q => {
    let diff: DiffRow[] = [];
    if (q.changeType === "updated" && q.previousData && typeof q.previousData === "object") {
      const prev = q.previousData as Record<string, unknown>;
      const pickAfter = (field: string): unknown => {
        switch (field) {
          case "name": return q.name;
          case "modelName": return q.modelName;
          case "category": return q.category;
          case "rentalPrice": return q.rentalPrice;
          case "cardDiscountPrice": return q.cardDiscountPrice;
          case "contractPeriod": return q.contractPeriod;
          case "managementType": return q.managementType;
          case "description": return q.description;
          default: return null;
        }
      };
      diff = Object.keys(prev).map(field => ({
        field,
        label: FIELD_LABELS[field] ?? field,
        before: formatVal(field, prev[field]),
        after: formatVal(field, pickAfter(field)),
      }));
    }

    // rawData에 보강된 imageUrls / keyFeatures / specs 미리보기로 노출
    const raw = (q.rawData ?? {}) as Record<string, unknown>;
    const previewImages = Array.isArray(raw.imageUrls)
      ? (raw.imageUrls as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 6)
      : [];
    const previewFeatures = Array.isArray(raw.keyFeatures)
      ? (raw.keyFeatures as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const previewSpecs = (raw.specs && typeof raw.specs === "object" && !Array.isArray(raw.specs))
      ? (raw.specs as Record<string, string>)
      : {};

    return {
      id: q.id,
      productCode: q.productCode ?? "",
      name: q.name,
      modelName: q.modelName,
      category: q.category,
      sourceUrl: q.sourceUrl,
      sourceName: q.source.name,
      changeType: (q.changeType as "new" | "updated" | "unchanged"),
      crawledAtLabel: fmt(q.crawledAt),
      rentalPrice: q.rentalPrice,
      cardDiscountPrice: q.cardDiscountPrice,
      contractPeriod: q.contractPeriod,
      managementType: q.managementType,
      description: q.description,
      previewImages,
      previewFeatures,
      previewSpecs,
      diff,
    };
  });

  const newCount = cards.filter(c => c.changeType === "new").length;
  const updatedCount = cards.filter(c => c.changeType === "updated").length;

  return (
    <>
      <div className="flex items-center gap-2.5 mb-0.5">
        <Link href="/admin/super/crawl" className="text-rk-info text-[14px] no-underline">← 크롤 소스</Link>
      </div>
      <h1 className="text-[20px] font-bold tracking-[-.02em]">검토 대기 큐</h1>
      <p className="text-rk-muted text-[14px] mb-2">
        총 {cards.length}건 · 신규 {newCount} · 변경 {updatedCount} — 승인 시 상품 마스터에 즉시 반영되며, 변경 이력은 ProductChangeLog에 기록됩니다.
      </p>
      <div className="bg-rk-tint-orange text-rk-orange-deep text-[13px] px-3 py-2 rounded mb-[18px]">
        ⓘ <b>가격 필드 (월 렌탈료 · 카드할인가)는 본사 정책표(xlsx) 단독 출처</b>입니다. 크롤가는 SK매직 매직몰 소매가라서 협력점 정책가와 다릅니다.
        승인해도 가격은 덮어쓰지 않습니다 — 참고용으로만 표시됩니다.
      </div>

      <CrawlReviewQueue cards={cards} />
    </>
  );
}
