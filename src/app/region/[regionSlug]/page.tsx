import Link from "next/link";
import { notFound } from "next/navigation";
import ProductThumb from "@/components/consumer/ProductThumb";
import PromotionBadge from "@/components/consumer/PromotionBadge";
import { findRegion, listRegionRecommendedProducts, categoryLabel } from "@/lib/regionSeo";
import { SITE_URL } from "@/lib/constants/site";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const CATEGORIES = ["water", "air", "bidet", "mattress", "massage"];

const PRODUCT_BG: Record<string, string> = {
  water:    "linear-gradient(160deg,#D8E2F0,#A4B4D0)",
  bidet:    "linear-gradient(160deg,#F0E5DA,#D6BFA8)",
  air:      "linear-gradient(160deg,#E5EAEF,#B8C2CD)",
  mattress: "linear-gradient(160deg,#DEE5F0,#A8B5CC)",
  massage:  "linear-gradient(160deg,#F0E8E0,#D0BFAE)",
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ regionSlug: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const { regionSlug } = await params;
  const { cat } = await searchParams;
  const region = await findRegion(regionSlug);
  if (!region) return { title: "지역 정보 없음" };
  const catLabel = cat ? categoryLabel(cat) : "SK매직 렌탈";
  const title = `${region.label} ${catLabel} — SK매직 인증파트너점 ${region.partners.length}곳`;
  const description = `${region.label}에서 SK매직 ${catLabel} 가입 — 본사 정책 그대로, 지역 인증파트너점 ${region.partners.length}곳 단독 사은품. 카드할인가 + 약정 옵션 즉시 비교.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "SK매직 인증파트너점",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `/region/${regionSlug}${cat ? `?cat=${cat}` : ""}`,
    },
  };
}

export default async function RegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ regionSlug: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const { regionSlug } = await params;
  const { cat } = await searchParams;
  const region = await findRegion(regionSlug);
  if (!region) notFound();
  const selectedCat = cat && CATEGORIES.includes(cat) ? cat : null;

  // 첫 협력점을 default로 추천 상품 목록 산출
  const primaryPartner = region.partners[0];
  const products = await listRegionRecommendedProducts(selectedCat, primaryPartner.partnerCode, 6);

  // structured data — LocalBusiness + Service
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `SK매직 인증파트너점 ${region.label}`,
    description: `${region.label} 지역의 SK매직 인증파트너점 ${region.partners.length}곳`,
    address: { "@type": "PostalAddress", addressRegion: region.shortLabel, addressCountry: "KR" },
    url: `${SITE_URL}/region/${regionSlug}`,
    areaServed: region.label,
    telephone: region.partners[0].partnerName,
    serviceArea: region.label,
  };

  return (
    <main className="min-h-screen bg-rk-soft-2">
      {/* Hero */}
      <section className="bg-rk-navy text-white px-5 py-10 relative overflow-hidden"
        style={{ backgroundImage: "radial-gradient(ellipse at 110% 110%, rgba(242,106,31,.45), transparent 50%)" }}>
        <div className="max-w-[640px] mx-auto">
          <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 bg-white/15 rounded-full font-medium mb-2.5">
            🌐 {region.shortLabel} 지역 페이지
          </span>
          <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-.03em] m-0 text-white">
            {region.label}<br />
            <span className="text-[#FFB374]">SK매직 {selectedCat ? categoryLabel(selectedCat) : "렌탈"}</span>
          </h1>
          <p className="text-[13px] opacity-85 m-0 mt-2 leading-[1.55]">
            본사 정책 그대로, {region.label} 협력점 {region.partners.length}곳에서 단독 사은품 / 즉시 설치.
            <br />
            카드할인가 · 60개월 약정 · 타사보상 모두 본사 정책 기준 적용.
          </p>
        </div>
      </section>

      {/* Category chips */}
      <section className="bg-white border-b border-rk-line px-5 py-3">
        <div className="max-w-[640px] mx-auto flex gap-1.5 overflow-x-auto pb-1">
          <Link
            href={`/region/${regionSlug}`}
            className={"px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap no-underline border " +
              (!selectedCat ? "bg-rk-navy text-white border-rk-navy" : "bg-white text-rk-text border-rk-line hover:bg-rk-soft-2")}>
            전체
          </Link>
          {CATEGORIES.map(c => (
            <Link
              key={c}
              href={`/region/${regionSlug}?cat=${c}`}
              className={"px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap no-underline border " +
                (selectedCat === c ? "bg-rk-navy text-white border-rk-navy" : "bg-white text-rk-text border-rk-line hover:bg-rk-soft-2")}>
              {categoryLabel(c)}
            </Link>
          ))}
        </div>
      </section>

      {/* Partner picks */}
      <section className="bg-white px-5 py-6 border-b-8 border-rk-soft-2">
        <div className="max-w-[640px] mx-auto">
          <h2 className="text-[16px] font-semibold text-rk-ink m-0 mb-3">📍 {region.shortLabel} 협력점 {region.partners.length}곳</h2>
          <div className="grid gap-2">
            {region.partners.map(p => (
              <Link
                key={p.partnerCode}
                href={`/p/${p.partnerCode}`}
                className="bg-rk-soft-2 hover:bg-rk-tint-blue border border-rk-line rounded-md p-3 flex items-center gap-3 no-underline transition-colors"
              >
                <div className="w-10 h-10 bg-rk-orange text-white rounded grid place-items-center font-bold text-[14px] tracking-[-.04em] shrink-0">
                  {p.partnerName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <b className="text-rk-ink block text-[13px]">{p.partnerName}</b>
                  <small className="text-rk-muted text-[11px] block truncate">{p.brandLabel}</small>
                  <small className="text-rk-faint text-[10px] block">{p.region}</small>
                </div>
                <span className="text-rk-info text-[12px]">사이트 →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Recommended products */}
      <section className="bg-white px-5 py-6 border-b-8 border-rk-soft-2">
        <div className="max-w-[640px] mx-auto">
          <h2 className="text-[16px] font-semibold text-rk-ink m-0 mb-1">
            🛒 {selectedCat ? categoryLabel(selectedCat) : "추천"} 상품 ({products.length})
          </h2>
          <p className="text-[11px] text-rk-muted mb-3 m-0">
            대표 협력점 <b>{primaryPartner.partnerName}</b> 기준 가격/사은품 — 다른 협력점 가입 시 사은품이 다를 수 있습니다.
          </p>
          {products.length === 0 ? (
            <div className="bg-rk-soft-2 rounded-md p-6 text-center text-[12px] text-rk-muted">
              해당 카테고리 상품이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map(p => (
                <Link
                  key={p.productCode}
                  href={`/p/${primaryPartner.partnerCode}/products/${p.productCode}`}
                  className="no-underline text-inherit cursor-pointer block group transition-transform hover:-translate-y-0.5"
                >
                  <ProductThumb
                    imageUrl={p.imageUrl}
                    alt={p.name}
                    fallbackBg={PRODUCT_BG[p.category] ?? PRODUCT_BG.water}
                  >
                    {p.giftAmount > 0 && <span className="text-[9px] px-1 py-px rounded text-white font-semibold bg-rk-orange">사은품</span>}
                    {p.isFeatured && <span className="text-[9px] px-1 py-px rounded text-white font-semibold bg-rk-navy">MD추천</span>}
                  </ProductThumb>
                  <div className="text-[11px] text-rk-muted mt-2">SK매직</div>
                  <h4 className="text-[13px] font-medium text-rk-ink leading-[1.4] m-0 mt-0.5 line-clamp-2 min-h-[36px]">{p.name}</h4>
                  <div className="text-[10px] text-rk-faint font-mono mt-0.5 truncate">{p.modelName}</div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <small className="text-[10px] text-rk-muted">월</small>
                    <b className="text-[16px] font-bold tracking-[-.02em] text-rk-ink rk-num">{fmt(p.rentalPrice)}<small className="text-[11px] font-medium">원~</small></b>
                  </div>
                  <PromotionBadge text={p.promotionBadge} />
                  {p.cardDiscountPrice != null && (
                    <div className="mt-px text-[10px] text-rk-sale font-medium">
                      카드 최대 <b className="font-bold rk-num">{fmt(p.cardDiscountPrice)}원</b>
                    </div>
                  )}
                  {p.giftLabel && <div className="text-[10px] text-rk-orange-deep font-medium mt-1 truncate">🎁 {p.giftLabel}</div>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white px-5 py-6">
        <div className="max-w-[640px] mx-auto text-center">
          <h3 className="text-[15px] font-semibold text-rk-ink m-0 mb-1">{region.shortLabel}에서 가입 진행</h3>
          <p className="text-[12px] text-rk-muted mb-3 m-0">
            가까운 {primaryPartner.partnerName}에서 즉시 상담받으세요.
          </p>
          <Link
            href={`/p/${primaryPartner.partnerCode}`}
            className="inline-block bg-rk-orange hover:bg-rk-orange-deep text-white px-5 py-3 rounded-lg font-semibold text-[13px] no-underline cursor-pointer"
          >
            {primaryPartner.partnerName} 사이트로 →
          </Link>
        </div>
      </section>

      {/* Other regions */}
      <section className="bg-rk-soft-2 px-5 py-5 border-t border-rk-line">
        <div className="max-w-[640px] mx-auto">
          <h3 className="text-[12px] text-rk-muted font-medium m-0 mb-2">다른 지역</h3>
          <div className="flex flex-wrap gap-1.5">
            <Link href="/" className="text-[11px] text-rk-info no-underline hover:underline">전체 허브 →</Link>
          </div>
        </div>
      </section>

      {/* Structured data */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
