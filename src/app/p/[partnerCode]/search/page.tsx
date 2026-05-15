import Link from "next/link";
import { notFound } from "next/navigation";
import PartnerHeader from "@/components/consumer/PartnerHeader";
import PartnerFooter from "@/components/consumer/PartnerFooter";
import PartnerCta from "@/components/consumer/PartnerCta";
import ProductThumb from "@/components/consumer/ProductThumb";
import SearchInput from "./SearchInput";
import { getPartnerHeader } from "@/lib/partnerSite";
import { searchPartnerProducts } from "@/lib/search";
import type { ConsumerProduct } from "@/lib/partnerSite";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const PRODUCT_BG: Record<string, string> = {
  water:    "linear-gradient(160deg,#D8E2F0,#A4B4D0)",
  bidet:    "linear-gradient(160deg,#F0E5DA,#D6BFA8)",
  air:      "linear-gradient(160deg,#E5EAEF,#B8C2CD)",
  mattress: "linear-gradient(160deg,#DEE5F0,#A8B5CC)",
  massage:  "linear-gradient(160deg,#F0E8E0,#D0BFAE)",
  dryer:    "linear-gradient(160deg,#E0E5EF,#B8C0D2)",
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ partnerCode: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { partnerCode } = await params;
  const { q } = await searchParams;
  const partner = await getPartnerHeader(partnerCode);
  if (!partner) return { title: "Not Found" };
  return { title: q ? `"${q}" 검색결과 · ${partner.partnerName}` : `검색 · ${partner.partnerName}` };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerCode: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { partnerCode } = await params;
  const { q = "" } = await searchParams;
  const partner = await getPartnerHeader(partnerCode);
  if (!partner) notFound();

  const trimmed = q.trim();
  const results = trimmed ? await searchPartnerProducts(partnerCode, trimmed) : [];

  return (
    <div className="bg-rk-soft-2 min-h-screen flex justify-center items-start gap-6 max-md:p-0 md:py-8">
      <div className="w-full md:w-[390px] bg-white md:rounded-[32px] md:shadow-[0_8px_24px_rgba(20,25,40,.08)] overflow-hidden md:border-8 md:border-[#1A1D24]">
        <div className="hidden md:flex bg-white h-9 items-center justify-between px-[22px] text-[14px] font-semibold">
          <span className="rk-num">9:41</span>
          <span>● ●</span>
        </div>

        <PartnerHeader partner={partner} showFullNav />

        {/* Search input */}
        <section className="bg-white px-4 py-3 border-b border-rk-line-2">
          <SearchInput partnerCode={partnerCode} initialQuery={q} />
        </section>

        {/* Results */}
        <section className="bg-white px-4 py-3">
          {!trimmed ? (
            <div className="text-center py-8">
              <div className="text-[36px] mb-2">🔍</div>
              <p className="text-[13px] text-rk-text m-0">
                상품명 / 모델번호로 검색해보세요.
              </p>
              <small className="text-[13px] text-rk-muted mt-1 block">예: PURE+, 비데, 안마의자</small>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[13px] text-rk-text">
                <b>&quot;{trimmed}&quot;</b> 검색 결과가 없습니다.
              </p>
              <small className="text-[13px] text-rk-muted block mt-2">
                다른 키워드로 검색하거나 카테고리에서 둘러보세요.
              </small>
              <div className="mt-3 flex gap-2 justify-center flex-wrap">
                <Link href={`/p/${partner.partnerCode}/category/water`} className="text-[13px] bg-rk-soft px-2 py-1 rounded no-underline text-rk-text">정수기</Link>
                <Link href={`/p/${partner.partnerCode}/category/bidet`} className="text-[13px] bg-rk-soft px-2 py-1 rounded no-underline text-rk-text">비데</Link>
                <Link href={`/p/${partner.partnerCode}/products`} className="text-[13px] bg-rk-soft px-2 py-1 rounded no-underline text-rk-text">전체 상품</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-[14px] text-rk-muted mb-3">
                <b className="text-rk-ink">&quot;{trimmed}&quot;</b> 검색 결과 <b className="text-rk-ink">{results.length}</b>건
              </div>
              <div className="grid grid-cols-2 gap-3">
                {results.map(p => (
                  <ResultCard
                    key={p.productCode}
                    product={p}
                    href={`/p/${partner.partnerCode}/products/${p.productCode}`}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <PartnerFooter partner={partner} />
        <PartnerCta partner={partner} />
      </div>
    </div>
  );
}

function ResultCard({ product, href }: { product: ConsumerProduct; href: string }) {
  const bg = PRODUCT_BG[product.category] ?? PRODUCT_BG.water;
  return (
    <Link href={href} className="no-underline text-inherit cursor-pointer">
      <ProductThumb imageUrl={product.imageUrl} alt={product.name} fallbackBg={bg}>
        {product.giftAmount > 0 && <span className="text-[9px] px-1 py-px rounded text-white font-semibold bg-rk-orange">사은품</span>}
        {product.isFeatured && <span className="text-[9px] px-1 py-px rounded text-white font-semibold bg-rk-navy">MD추천</span>}
      </ProductThumb>
      <div className="text-[13px] text-rk-muted mt-2">SK매직</div>
      <h4 className="text-[13px] font-medium text-rk-ink leading-[1.4] m-0 mt-0.5">{product.name}</h4>
      <div className="text-[12px] text-rk-faint font-mono mt-0.5">{product.modelName}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <small className="text-[12px] text-rk-muted">월</small>
        <b className="text-[15px] font-bold tracking-[-.02em] text-rk-ink rk-num">{fmt(product.rentalPrice)}원~</b>
      </div>
      {product.cardDiscountPrice != null && (
        <div className="mt-px text-[12px] text-rk-sale font-medium">
          카드할인 시 최대 <b className="font-bold rk-num">월 {fmt(product.cardDiscountPrice)}원</b>
        </div>
      )}
      {product.giftLabel && (
        <div className="text-[12px] text-rk-orange-deep font-medium mt-1">🎁 {product.giftLabel}</div>
      )}
    </Link>
  );
}
