import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { pickRepresentativeHqPolicy } from "@/lib/hqPolicy";

export const metadata = { title: "상품 마스터 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const CATEGORY_LABEL: Record<string, string> = {
  water: "정수기", bidet: "비데", air: "공기청정기",
  mattress: "매트리스", massage: "안마의자", dryer: "건조기",
};

export default async function ProductMasterPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { rentalPrice: "desc" }],
    include: { hqPolicies: true, _count: { select: { partnerPolicies: true } } },
  });

  return (
    <>
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <h1 className="text-[20px] font-bold tracking-[-.02em]">상품 마스터</h1>
        <Link
          href="/admin/super/products/new"
          className="ml-auto bg-rk-orange hover:bg-rk-orange-deep text-white px-3 py-1.5 rounded text-[14px] font-medium no-underline transition-colors"
        >
          + 신규 상품 등록
        </Link>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        본사가 관리하는 상품 카탈로그 · 전국 공통 가격 · 협력점은 사은품으로만 차별화 · {products.length}개 등록
      </p>

      <div className="bg-white border border-rk-line rounded-lg p-4">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              {["코드", "상품", "카테고리", "월 렌탈료", "카드할인가", "본사 수수료(합)", "협력점 정책", "상태", ""].map(h => (
                <th key={h} className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const rep = pickRepresentativeHqPolicy(p);
              return (
              <tr key={p.productCode} className="hover:bg-rk-soft-2">
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 font-mono text-[13px] text-rk-faint">{p.productCode}</td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <Link href={`/admin/super/products/${p.productCode}`} className="text-rk-ink no-underline">
                    <b className="block hover:underline">{p.name}</b>
                    <small className="text-[12px] text-rk-faint font-mono">{p.modelName} · {p.managementType}</small>
                  </Link>
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 text-rk-text">
                  {CATEGORY_LABEL[p.category] ?? p.category}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">월 {fmt(p.rentalPrice)}원</td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-rk-sale">
                  {p.cardDiscountPrice != null ? `월 ${fmt(p.cardDiscountPrice)}원` : "—"}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-rk-success">
                  {rep ? `+₩${fmt(rep.baseCommission + rep.monthIncentive)}` : "—"}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">{p._count.partnerPolicies}개점</td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <span
                    className={
                      "text-[12px] px-1.5 py-px rounded font-medium " +
                      (p.status === "active"
                        ? p.isFeatured
                          ? "bg-rk-tint-orange text-rk-orange-deep"
                          : "bg-rk-tint-green text-rk-success"
                        : "bg-rk-tint-gray text-rk-muted")
                    }
                  >
                    {p.isFeatured ? "FEATURED" : p.status}
                  </span>
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <Link
                    href={`/admin/super/products/${p.productCode}`}
                    className="text-[13px] text-rk-info no-underline whitespace-nowrap"
                  >
                    편집 →
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px]">
        ⓘ 상품 행 또는 &quot;편집 →&quot; 클릭으로 상세 편집 (이미지·설명·셀링포인트·사양표). 변경 시 모든 협력점 사이트에 즉시 반영됩니다.
      </div>
    </>
  );
}
