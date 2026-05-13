import Link from "next/link";
import { notFound } from "next/navigation";
import PartnerHeader from "@/components/consumer/PartnerHeader";
import PartnerFooter from "@/components/consumer/PartnerFooter";
import PartnerCta from "@/components/consumer/PartnerCta";
import ProductThumb from "@/components/consumer/ProductThumb";
import { getPartnerHeader, listPartnerProducts, type ConsumerProduct } from "@/lib/partnerSite";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const CATEGORY_LABEL: Record<string, string> = {
  water:    "정수기",
  bidet:    "비데",
  air:      "공기청정기",
  mattress: "매트리스",
  massage:  "안마의자",
  dryer:    "건조기",
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
  params: Promise<{ partnerCode: string }>;
}) {
  const { partnerCode } = await params;
  const partner = await getPartnerHeader(partnerCode);
  if (!partner) return { title: "Not Found" };
  return { title: `전체 상품 · ${partner.partnerName}` };
}

export default async function AllProductsPage({
  params,
}: {
  params: Promise<{ partnerCode: string }>;
}) {
  const { partnerCode } = await params;
  const partner = await getPartnerHeader(partnerCode);
  if (!partner) notFound();

  const products = await listPartnerProducts(partnerCode);
  const byCategory = new Map<string, ConsumerProduct[]>();
  for (const p of products) {
    const key = p.category;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(p);
  }

  const giftCount = products.filter(p => p.giftAmount > 0).length;

  return (
    <div className="bg-rk-soft-2 min-h-screen flex justify-center items-start gap-6 max-md:p-0 md:py-8">
      <div className="w-full md:w-[390px] bg-white md:rounded-[32px] md:shadow-[0_8px_24px_rgba(20,25,40,.08)] overflow-hidden md:border-8 md:border-[#1A1D24]">
        <div className="hidden md:flex bg-white h-9 items-center justify-between px-[22px] text-[12px] font-semibold">
          <span className="rk-num">9:41</span>
          <span>● ●</span>
        </div>

        <PartnerHeader partner={partner} showFullNav />

        <section className="bg-white px-4 pt-4 pb-3 border-b border-rk-line-2">
          <h1 className="text-[20px] font-bold text-rk-ink tracking-[-.02em] m-0">전체 상품</h1>
          <p className="text-[12px] text-rk-muted mt-1 m-0">
            <b>{products.length}</b>개 상품 · <span className="text-rk-orange-deep">사은품 {giftCount}개 운영</span>
          </p>
        </section>

        {/* Per-category sections */}
        {Array.from(byCategory.entries()).map(([cat, items]) => (
          <section key={cat} className="bg-white px-4 pt-4 pb-4 border-b-8 border-rk-soft">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-rk-ink">{CATEGORY_LABEL[cat] ?? cat}</h2>
              <Link href={`/p/${partner.partnerCode}/category/${cat}`} className="text-[12px] text-rk-info no-underline">
                {CATEGORY_LABEL[cat] ?? cat} 전체 →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {items.map(p => (
                <ProductCard
                  key={p.productCode}
                  product={p}
                  href={`/p/${partner.partnerCode}/products/${p.productCode}`}
                />
              ))}
            </div>
          </section>
        ))}

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
      </ProductThumb>
      <div className="text-[11px] text-rk-muted mt-2">SK매직</div>
      <h4 className="text-[13px] font-medium text-rk-ink leading-[1.4] m-0 mt-0.5">{product.name}</h4>
      <div className="text-[10px] text-rk-faint font-mono mt-0.5">{product.modelName}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <small className="text-[10px] text-rk-muted">월</small>
        <b className="text-[15px] font-bold tracking-[-.02em] text-rk-ink rk-num">{fmt(product.rentalPrice)}원~</b>
      </div>
      {product.cardDiscountPrice && (
        <div className="mt-px text-[10px] text-rk-sale font-medium">
          카드할인가 <b className="font-bold rk-num">월 {fmt(product.cardDiscountPrice)}원</b>
        </div>
      )}
      {product.giftLabel && (
        <div className="text-[10px] text-rk-orange-deep font-medium mt-1">🎁 {product.giftLabel}</div>
      )}
    </Link>
  );
}
