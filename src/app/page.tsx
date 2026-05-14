import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listActivePartners } from "@/lib/partnerSite";
import { listAllRegionSlugs } from "@/lib/regionSeo";
import Footer from "@/components/hub/Footer";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "렌트왕 — 동네 SK매직 공식 협력점 한 번에 비교",
  description: "정수기·공기청정기·비데·매트리스 렌탈 — 동네 협력점에서 사은품 차별화된 가격으로 상담받으세요.",
};

const CATEGORY_LABEL: Record<string, string> = {
  water: "정수기", air: "공기청정기", bidet: "비데", mattress: "매트리스",
  massage: "안마의자", dryer: "건조기", kitchen: "주방가전",
};
const CATEGORY_ICON: Record<string, string> = {
  water: "💧", air: "💨", bidet: "🚿", mattress: "🛏️",
  massage: "💆", dryer: "🧺", kitchen: "🍳",
};

export default async function HubPage() {
  const [partners, regions, featuredProducts, categoryCounts] = await Promise.all([
    listActivePartners(),
    listAllRegionSlugs(),
    prisma.product.findMany({
      where: { status: "active", isFeatured: true },
      orderBy: [{ rentalPrice: "asc" }],
      take: 6,
      select: { productCode: true, name: true, modelName: true, category: true, rentalPrice: true, cardDiscountPrice: true, imageUrl: true, imageUrls: true },
    }),
    prisma.product.groupBy({
      by: ["category"],
      where: { status: "active" },
      _count: { _all: true },
    }),
  ]);

  const defaultPartner = partners[0]?.partnerCode ?? "gangnam-skmagic";
  const counts: Record<string, number> = {};
  for (const r of categoryCounts) counts[r.category] = r._count._all;
  const activeCategories = Object.keys(CATEGORY_LABEL).filter(k => (counts[k] ?? 0) > 0);

  return (
    <div className="bg-rk-soft-2 min-h-screen flex flex-col">
      {/* ─────────────────────── 헤더 ─────────────────────── */}
      <header className="bg-white border-b border-rk-line">
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex justify-between items-center flex-wrap gap-3">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 bg-rk-orange text-white rounded grid place-items-center font-bold text-[14px]">RK</div>
            <span className="text-[17px] font-bold text-rk-ink">렌트왕</span>
            <span className="text-[11px] text-rk-muted hidden sm:inline">SK매직 공식 협력점 분양 플랫폼</span>
          </Link>
          <div className="flex gap-2 items-center">
            <Link
              href="/apply"
              className="bg-rk-orange hover:bg-rk-orange-deep text-white px-3.5 py-2 rounded text-[13px] font-semibold no-underline transition-colors"
            >
              📝 협력점 분양 신청
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          {/* ─────────────────────── 히어로 ─────────────────────── */}
          <section className="mb-10">
            <h1 className="text-[28px] md:text-[34px] font-bold tracking-[-.025em] leading-[1.25] mb-3 text-rk-ink">
              우리 동네 <span className="text-rk-orange">SK매직 공식 협력점</span>을<br className="hidden md:block" />
              한 번에 비교하세요
            </h1>
            <p className="text-[14px] md:text-[15px] text-rk-muted leading-[1.65] max-w-[640px]">
              정수기·공기청정기·비데·매트리스 렌탈을 동네 협력점에서 상담받으세요.
              협력점마다 사은품·설치비 혜택이 다르며, 본사 표준 정책 아래 안전하게 거래됩니다.
            </p>

            {/* 카테고리 진입 그리드 — 기본 협력점 사이트의 카테고리 라우트로 */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 mt-6">
              {activeCategories.map(k => (
                <Link
                  key={k}
                  href={`/p/${defaultPartner}/category/${k}`}
                  className="bg-white border border-rk-line rounded-lg px-3 py-4 text-center hover:border-rk-orange hover:shadow-[0_2px_8px_rgba(20,25,40,.06)] transition-all no-underline"
                >
                  <div className="text-[26px] mb-1">{CATEGORY_ICON[k]}</div>
                  <b className="text-[13px] text-rk-ink block">{CATEGORY_LABEL[k]}</b>
                  <small className="text-[11px] text-rk-muted">{counts[k]}종</small>
                </Link>
              ))}
            </div>
          </section>

          {/* ─────────────────────── 인기 상품 ─────────────────────── */}
          {featuredProducts.length > 0 && (
            <section className="mb-10">
              <div className="flex items-baseline gap-2 mb-3">
                <h2 className="text-[18px] font-bold text-rk-ink">🌟 추천 인기 모델</h2>
                <small className="text-[12px] text-rk-muted">본사 추천 상품 · 협력점마다 사은품 다름</small>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {featuredProducts.map(p => {
                  const thumb = p.imageUrls?.[0] ?? p.imageUrl;
                  const card = p.cardDiscountPrice != null && p.cardDiscountPrice < p.rentalPrice ? p.cardDiscountPrice : null;
                  return (
                    <Link
                      key={p.productCode}
                      href={`/p/${defaultPartner}/products/${p.productCode}`}
                      className="bg-white border border-rk-line rounded-lg p-3 hover:border-rk-navy transition-colors no-underline"
                    >
                      <div className="aspect-[4/3] bg-rk-soft-2 rounded mb-2 overflow-hidden">
                        {thumb && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
                        )}
                      </div>
                      <small className="text-[11px] text-rk-faint font-mono">{CATEGORY_LABEL[p.category] ?? p.category}</small>
                      <b className="block text-[14px] text-rk-ink mt-0.5 leading-[1.3]">{p.name}</b>
                      <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
                        <b className="text-[15px] text-rk-orange-deep rk-num">월 {p.rentalPrice.toLocaleString("ko-KR")}원</b>
                        {card && (
                          <small className="text-[11px] text-rk-sale rk-num">카드 {card.toLocaleString("ko-KR")}원~</small>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ─────────────────────── 지역으로 시작 ─────────────────────── */}
          {regions.length > 0 && (
            <section className="bg-white border border-rk-line rounded-lg p-5 mb-6">
              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="text-[15px] font-bold text-rk-ink">🌐 지역으로 시작</h3>
                <small className="text-[12px] text-rk-muted">우리 동네 협력점 + 추천 상품 한 번에</small>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {regions.map(r => (
                  <Link
                    key={r.slug}
                    href={`/region/${r.slug}`}
                    className="bg-rk-tint-blue hover:bg-rk-info hover:text-white border border-[#D8E4F4] rounded p-2.5 text-rk-info no-underline transition-colors"
                  >
                    <b className="block text-[12px]">{r.label}</b>
                    <small className="block text-[10px] opacity-80 mt-0.5">{r.partners.length}개 협력점</small>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ─────────────────────── 전체 협력점 ─────────────────────── */}
          <section className="bg-white border border-rk-line rounded-lg p-5 mb-12">
            <div className="flex items-baseline gap-2 mb-3 flex-wrap">
              <h3 className="text-[15px] font-bold text-rk-ink">🏪 전체 협력점 ({partners.length})</h3>
              <small className="text-[12px] text-rk-muted">동일한 상품 마스터, 협력점마다 다른 사은품·차별화</small>
            </div>
            {partners.length === 0 ? (
              <div className="bg-rk-tint-orange text-rk-orange-deep px-3 py-2 rounded text-[13px]">
                현재 등록된 활성 협력점이 없습니다. 협력점 사장님이시면{" "}
                <Link href="/apply" className="underline">분양 신청</Link>해주세요.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {partners.map(p => (
                  <Link
                    key={p.partnerCode}
                    href={`/p/${p.partnerCode}`}
                    className="block bg-rk-soft-2 hover:bg-white hover:border-rk-navy border border-rk-line-2 rounded-md p-3 no-underline transition-colors"
                  >
                    <b className="block text-[14px] text-rk-ink">{p.partnerName}</b>
                    <small className="block text-rk-muted text-[11px] mt-0.5">{p.brandLabel}</small>
                    <small className="block text-rk-muted text-[11px] mt-0.5">📍 {p.region ?? "전국"}</small>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ─────────────────────── 협력점 모집 (Phase C) ─────────────────────── */}
          <section className="bg-rk-navy text-white rounded-xl p-6 md:p-9 mb-12 border border-rk-navy-deep">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center mb-6">
              <div>
                <small className="text-rk-orange tracking-[.12em] font-medium text-[11px]">FRANCHISE RECRUITMENT</small>
                <h2 className="text-[22px] md:text-[26px] font-bold tracking-[-.02em] leading-[1.3] mt-1 mb-2">
                  SK매직 협력점 사장님이세요?<br />
                  <span className="text-rk-orange">자기 도메인으로 분양받으세요.</span>
                </h2>
                <p className="text-[13px] text-white/70 leading-[1.7] max-w-[520px]">
                  본사 상품 마스터 그대로, 우리 매장만의 사은품과 가격으로 차별화하세요.
                  소비자 트래픽은 협력점 사이트에서 발생하며, 본사는 결제·정산·CS 표준만 관리합니다.
                </p>
              </div>
              <Link
                href="/apply"
                className="bg-rk-orange hover:bg-rk-orange-deep text-white px-5 py-3 rounded-md text-[14px] font-semibold no-underline whitespace-nowrap transition-colors text-center"
              >
                📝 분양 신청하기 →
              </Link>
            </div>

            {/* 3단계 절차 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <Step num="1" title="신청 접수" desc="사업자등록증·통신판매번호·운영 계획을 제출하면 본사가 1영업일 안에 검토합니다." />
              <Step num="2" title="본사 승인" desc="자격 검증 후 분양 패키지(기본/스탠다드/프리미엄) 와 도메인을 매칭합니다." />
              <Step num="3" title="사이트 개설" desc="자기 도메인의 협력점 사이트와 관리자 콘솔이 즉시 발급됩니다. 평균 24시간 내 분양 완료." />
            </div>

            {/* 패키지 비교 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Package
                tier="기본"
                priceNote="가입비 무료"
                features={["1개 도메인 + 1개 영업자", "본사 상품 마스터 그대로", "사은품·설치비 환원 편집"]}
              />
              <Package
                tier="스탠다드"
                priceNote="월 분양료 별도"
                features={["진열 순서 드래그 편집", "이벤트 배너 5개 동시 편성", "영업자 5명까지 + 단독 링크"]}
                highlight
              />
              <Package
                tier="프리미엄"
                priceNote="월 분양료 별도"
                features={["사은품 환원 한도 80%", "영업자 무제한 + AB 테스트", "본사 마케팅 분석 대시보드 접근"]}
              />
            </div>
            <p className="text-[12px] text-white/55 mt-4 leading-[1.7]">
              ⓘ 정확한 분양료·계약 조건은 자격 검증 후 본사에서 안내드립니다. 분양 신청은 협력점 자격(사업자등록증·통신판매신고)이 있는 사장님만 가능합니다.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="bg-rk-navy-deep border border-white/10 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-rk-orange text-white grid place-items-center font-bold text-[13px]">{num}</div>
        <b className="text-white text-[14px]">{title}</b>
      </div>
      <p className="text-[12px] text-white/65 leading-[1.6] m-0">{desc}</p>
    </div>
  );
}

function Package({
  tier, priceNote, features, highlight,
}: {
  tier: string;
  priceNote: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg p-4 border " +
        (highlight
          ? "bg-rk-orange/15 border-rk-orange"
          : "bg-rk-navy-deep border-white/10")
      }
    >
      <div className="flex items-baseline justify-between mb-2">
        <b className={"text-[15px] " + (highlight ? "text-rk-orange" : "text-white")}>{tier}</b>
        <small className={"text-[11px] " + (highlight ? "text-rk-orange/80" : "text-white/55")}>{priceNote}</small>
      </div>
      <ul className="space-y-1 text-[12px] text-white/70 leading-[1.6]">
        {features.map((f, i) => (
          <li key={i} className="flex gap-1.5"><span className={highlight ? "text-rk-orange" : "text-white/40"}>✓</span><span>{f}</span></li>
        ))}
      </ul>
    </div>
  );
}
