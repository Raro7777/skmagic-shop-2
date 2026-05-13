import Link from "next/link";
import { notFound } from "next/navigation";
import PartnerHeader from "@/components/consumer/PartnerHeader";
import PartnerFooter from "@/components/consumer/PartnerFooter";
import PartnerCta from "@/components/consumer/PartnerCta";
import ProductThumb from "@/components/consumer/ProductThumb";
import { getPartnerHeader, listPartnerProducts, type ConsumerProduct } from "@/lib/partnerSite";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const CATEGORY_LABEL: Record<string, { name: string; emoji: string; description: string }> = {
  water:    { name: "정수기",       emoji: "💧", description: "직수·RO·얼음정수기까지 — 가족 인원에 맞춰 추천드립니다." },
  bidet:    { name: "비데",         emoji: "🚿", description: "자가/방문관리 모두 — 무료 설치." },
  air:      { name: "공기청정기",   emoji: "💨", description: "거실 평수에 맞춰 32평·45평형 등." },
  mattress: { name: "매트리스",     emoji: "🛏",  description: "메모리폼·라텍스 — 정기 세탁 케어 포함." },
  massage:  { name: "안마의자",     emoji: "💆", description: "팔콘·해머링 등 — 매장 시연 가능." },
  dryer:    { name: "건조기",       emoji: "👕", description: "16kg 인버터 — 빨래방 부럽지 않게." },
};

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
}: {
  params: Promise<{ partnerCode: string; slug: string }>;
}) {
  const { partnerCode, slug } = await params;
  const partner = await getPartnerHeader(partnerCode);
  const cat = CATEGORY_LABEL[slug];
  if (!partner || !cat) return { title: "Not Found" };
  return { title: `${cat.name} · ${partner.partnerName}` };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ partnerCode: string; slug: string }>;
}) {
  const { partnerCode, slug } = await params;
  const cat = CATEGORY_LABEL[slug];
  if (!cat) notFound();

  const partner = await getPartnerHeader(partnerCode);
  if (!partner) notFound();

  const products = await listPartnerProducts(partnerCode, { category: slug });

  return (
    <div className="bg-rk-soft-2 min-h-screen flex justify-center items-start gap-6 max-md:p-0 md:py-8">
      <div className="w-full md:w-[390px] bg-white md:rounded-[32px] md:shadow-[0_8px_24px_rgba(20,25,40,.08)] overflow-hidden md:border-8 md:border-[#1A1D24]">
        <div className="hidden md:flex bg-white h-9 items-center justify-between px-[22px] text-[14px] font-semibold">
          <span className="rk-num">9:41</span>
          <span>● ●</span>
        </div>

        <PartnerHeader partner={partner} showFullNav />

        {/* Category banner */}
        <section className="bg-rk-tint-blue px-4 py-5 border-b border-[#D8E4F4]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm grid place-items-center text-[28px]">
              {cat.emoji}
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-rk-ink m-0 tracking-[-.02em]">{cat.name}</h1>
              <p className="text-[13px] text-rk-text m-0 mt-1">{cat.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 text-[13px]">
            <span className="text-rk-muted">상품 <b className="text-rk-ink rk-num">{products.length}</b>개</span>
            {products.some(p => p.giftAmount > 0) && (
              <span className="text-rk-orange-deep">🎁 {products.filter(p => p.giftAmount > 0).length}개 사은품 운영 중</span>
            )}
          </div>
        </section>

        {/* Products grid */}
        <section className="bg-white px-4 py-4">
          {products.length === 0 ? (
            <div className="text-center py-10 text-[14px] text-rk-muted">
              {cat.name} 카테고리에 등록된 상품이 없습니다.
              <div className="mt-2">
                <Link href={`/p/${partner.partnerCode}/products`} className="text-rk-info underline">
                  전체 상품 보기 →
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map(p => (
                <ProductCard
                  key={p.productCode}
                  product={p}
                  href={`/p/${partner.partnerCode}/products/${p.productCode}`}
                />
              ))}
            </div>
          )}
        </section>

        {/* Cross-sell — other categories */}
        <section className="bg-white px-4 py-4 border-t-8 border-rk-soft">
          <h3 className="text-[14px] font-semibold text-rk-ink mb-2">다른 카테고리</h3>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(CATEGORY_LABEL)
              .filter(([key]) => key !== slug)
              .slice(0, 6)
              .map(([key, c]) => (
                <Link
                  key={key}
                  href={`/p/${partner.partnerCode}/category/${key}`}
                  className="flex flex-col items-center gap-1 py-3 bg-rk-soft-2 rounded-md no-underline text-rk-text text-[13px] font-medium"
                >
                  <span className="text-[24px]">{c.emoji}</span>
                  {c.name}
                </Link>
              ))}
          </div>
        </section>

        <PartnerFooter partner={partner} />
        <PartnerCta partner={partner} />
      </div>
    </div>
  );
}

function ProductCard({ product, href }: { product: ConsumerProduct; href: string }) {
  const bg = PRODUCT_BG[product.category] ?? PRODUCT_BG.water;
  return (
    <Link href={href} className="no-underline text-inherit cursor-pointer">
      <ProductThumb imageUrl={product.imageUrl} alt={product.name} fallbackBg={bg}>
        {product.giftAmount > 0 && <span className="text-[9px] px-1 py-px rounded text-white font-semibold bg-rk-orange">사은품</span>}
        {product.isFeatured && <span className="text-[9px] px-1 py-px rounded text-white font-semibold bg-rk-navy">MD추천</span>}
        {product.installFreed && <span className="text-[9px] px-1 py-px rounded text-white font-semibold bg-rk-success">설치비 면제</span>}
      </ProductThumb>
      <div className="text-[13px] text-rk-muted mt-2">SK매직</div>
      <h4 className="text-[13px] font-medium text-rk-ink leading-[1.4] m-0 mt-0.5">{product.name}</h4>
      <div className="text-[12px] text-rk-faint font-mono mt-0.5">{product.modelName}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <small className="text-[12px] text-rk-muted">월</small>
        <b className="text-[15px] font-bold tracking-[-.02em] text-rk-ink rk-num">{fmt(product.rentalPrice)}원~</b>
      </div>
      {product.cardDiscountPrice && (
        <div className="mt-px text-[12px] text-rk-sale font-medium">
          카드할인가 <b className="font-bold rk-num">월 {fmt(product.cardDiscountPrice)}원</b>
        </div>
      )}
      <div className="flex gap-0.5 flex-wrap mt-1.5">
        <span className="text-[9px] px-1 py-px rounded bg-rk-soft text-rk-muted">의무 {product.contractPeriod}</span>
        <span className="text-[9px] px-1 py-px rounded bg-rk-soft text-rk-muted">{product.managementType}</span>
      </div>
      {product.giftLabel && (
        <div className="text-[12px] text-rk-orange-deep font-medium mt-1">🎁 {product.giftLabel}</div>
      )}
    </Link>
  );
}
