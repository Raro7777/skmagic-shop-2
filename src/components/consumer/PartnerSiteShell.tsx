import Link from "next/link";
import HeroCarousel from "@/components/consumer/HeroCarousel";
import LiveActivityStrip from "@/components/consumer/LiveActivityStrip";
import ReviewCarousel from "@/components/consumer/ReviewCarousel";
import NavTabs from "@/components/consumer/NavTabs";
import RankingTabs from "@/components/consumer/RankingTabs";
import ConsultForm from "@/components/consumer/ConsultForm";
import UtmTracker from "@/components/consumer/UtmTracker";
import { listActivePartners, type ConsumerProduct, type PartnerSiteData } from "@/lib/partnerSite";
import { SK_MAGIC_LOGO } from "@/lib/constants/assets";
import { HQ_HOTLINE } from "@/lib/constants/hq";
import { rawAnchorHtml } from "@/lib/naverConvButton";

const fmt = (n: number) => n.toLocaleString("ko-KR");

// 메인 카드 관리방식 라벨 — pickLowestPrice 가 채택한 옵션의 mode 기준으로 안내.
// 셀프형이 채택되면 "자가관리" 로 (방문형보다 저렴해서 헤드라인이 셀프형으로 잡힐 때),
// 방문형이면 "방문관리" 로. mode 정보 없으면 Product.managementType 그대로.
// picks/ranking 등 카드 묶음에서 공통 조건 추출 — 의무기간·관리방식이 모두 동일하면
// 섹션 헤더에 1줄로 노출하고 각 카드의 의무/관리 칩은 제거해 공간 절약.
function commonCondition(items: ConsumerProduct[]): string | null {
  if (items.length === 0) return null;
  const firstPeriod = items[0].contractPeriod;
  const firstMode = managementLabel(items[0]);
  const samePeriod = items.every(p => p.contractPeriod === firstPeriod);
  const sameMode = items.every(p => managementLabel(p) === firstMode);
  if (samePeriod && sameMode) return `의무 ${firstPeriod}개월 · ${firstMode} 기준`;
  if (samePeriod) return `의무 ${firstPeriod}개월 기준`;
  if (sameMode) return `${firstMode} 기준`;
  return null;
}

function managementLabel(p: ConsumerProduct): string {
  if (p.lowestMode === "셀프형") return "자가관리형";
  if (p.lowestMode === "방문형") return "방문관리형";
  return p.managementType;
}


// 설치 가능일 — 오늘 + 1일. 한국 시간대 기준 "M/D(요일)" 라벨.
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
function nextInstallLabel(): string {
  const KR_OFFSET = 9 * 60; // minutes
  const now = new Date();
  // UTC + 9h 로 KST 변환
  const kst = new Date(now.getTime() + (KR_OFFSET - now.getTimezoneOffset()) * 60 * 1000);
  kst.setDate(kst.getDate() + 1);
  return `${kst.getMonth() + 1}/${kst.getDate()}(${DOW[kst.getDay()]})`;
}

// QUICK nav는 PartnerSiteData.categories 기반 자동 생성 — 별도 정적 배열 제거됨

const RANK_BG = [
  "linear-gradient(160deg,#D8E2F0,#A4B4D0)",
  "linear-gradient(160deg,#E0E5EF,#B8C0D2)",
  "linear-gradient(160deg,#DEE6F2,#9FB0CC)",
  "linear-gradient(160deg,#E8EBF2,#C2C8D6)",
];

const PICK_BG = [
  "linear-gradient(160deg,#F0E5DA,#D6BFA8)",
  "linear-gradient(160deg,#E5EAEF,#B8C2CD)",
  "linear-gradient(160deg,#DEE5F0,#A8B5CC)",
  "linear-gradient(160deg,#F0E8E0,#D0BFAE)",
];

export type SellerInfo = {
  sellerCode: string;
  name: string;
  phone?: string | null;
};

export default async function PartnerSiteShell({
  data,
  seller,
}: {
  data: PartnerSiteData;
  seller?: SellerInfo | null;
}) {
  const { partner, hero, ranking, picks } = data;
  const others = (await listActivePartners()).filter(p => p.partnerCode !== partner.partnerCode);

  // Hero 슬라이더 — hero + 사은품 차별화 우선 + 랭킹 상위 4-5개 (중복 제거).
  // displayConfig.heroAutoSlidesEnabled === false 면 자동 슬라이드 끔 (DB 배너만 노출).
  const heroSlides: ConsumerProduct[] = [];
  if (data.heroAutoSlidesEnabled) {
    const seen = new Set<string>();
    const tryAdd = (p: ConsumerProduct | null | undefined) => {
      if (!p || seen.has(p.productCode) || heroSlides.length >= 5) return;
      seen.add(p.productCode);
      heroSlides.push(p);
    };
    tryAdd(hero);
    for (const p of picks) tryAdd(p);
    for (const p of ranking) tryAdd(p);
  }

  // For seller-tagged links, we want product detail to also pass seller (via query for now)
  const productHref = (productCode: string) =>
    seller
      ? `/p/${partner.partnerCode}/products/${productCode}?s=${encodeURIComponent(seller.sellerCode)}`
      : `/p/${partner.partnerCode}/products/${productCode}`;

  return (
    <div className="bg-rk-soft-2 min-h-screen flex justify-center items-start gap-6 max-md:p-0 md:py-8">
      <UtmTracker />
      {/* Left tip sidebar — 컨슈머 노출 금지. 개발/내부 전용 */}
      <aside className="hidden w-[220px] sticky top-8 text-[14px] text-rk-muted leading-[1.65]">
        <h6 className="text-[13px] text-rk-faint tracking-[.12em] uppercase mb-2">분양 사이트</h6>
        <b className="text-rk-ink block">{partner.partnerName}</b>
        <small className="block text-rk-muted">{partner.brandLabel}</small>
        <small className="block text-rk-muted mt-0.5">{partner.region}</small>
        {seller && (
          <div className="bg-rk-tint-orange border border-[#F4DCC9] rounded p-2 mt-2 text-[13px]">
            <b className="text-rk-orange-deep block">담당 영업: {seller.name}</b>
            <small className="text-rk-orange-deep">이 링크로 접수된 상담은 이 영업자에게 자동 배정됩니다.</small>
          </div>
        )}

        <h6 className="text-[13px] text-rk-faint tracking-[.12em] uppercase mt-4 mb-2">다른 협력점 사이트</h6>
        {others.map(p => (
          <Link key={p.partnerCode} href={`/p/${p.partnerCode}`} className="block py-1.5 border-b border-rk-line-2 text-rk-info no-underline text-[14px]">
            {p.partnerName} →
          </Link>
        ))}

        <h6 className="text-[13px] text-rk-faint tracking-[.12em] uppercase mt-4 mb-2">관리자 이동</h6>
        <Link href="/" className="block py-1.5 border-b border-rk-line-2 text-rk-info no-underline text-[14px]">← 허브로</Link>
        <Link href="/admin/franchise" className="block py-1.5 border-b border-rk-line-2 text-rk-info no-underline text-[14px]">분양주 관리자 →</Link>
        <Link href="/admin/super" className="block py-1.5 border-b border-rk-line-2 text-rk-info no-underline text-[14px]">슈퍼관리자 →</Link>
      </aside>

      {/* Device frame */}
      <div className="w-full md:w-[390px] bg-white md:rounded-[32px] md:shadow-[0_8px_24px_rgba(20,25,40,.08)] max-md:overflow-visible md:overflow-hidden md:border-8 md:border-[#1A1D24]">
        <div className="hidden md:flex bg-white h-9 items-center justify-between px-[22px] text-[14px] font-semibold">
          <span className="rk-num">9:41</span>
          <span>● ●</span>
        </div>

        <header className="bg-white border-b border-rk-line">
          {/* 로고/브랜드 — 클릭 시 메인으로 이동. 햄버거 메뉴 제거, 로고를 좌측 첫 위치로 */}
          <div className="px-4 py-3 flex items-center gap-2.5">
            <Link
              href={`/p/${partner.partnerCode}`}
              className="flex items-center gap-2 no-underline"
              style={{ color: "inherit" }}
              aria-label="홈으로"
            >
              <img src={SK_MAGIC_LOGO} alt="SK magic" className="h-[36px] w-auto" />

              <div className="min-w-0">
                <div className="font-bold text-[16px] text-rk-ink tracking-[-.02em] leading-tight whitespace-nowrap">{partner.partnerName}</div>
                {partner.brandLabel && partner.brandLabel !== partner.partnerName && (
                  <div className="text-[13px] text-rk-muted whitespace-nowrap truncate">{partner.brandLabel}</div>
                )}
              </div>
            </Link>
            <div className="ml-auto flex gap-3.5 text-[20px] text-rk-ink">
              <Link href={`/p/${partner.partnerCode}/search`} className="text-rk-ink no-underline cursor-pointer" aria-label="검색">🔍</Link>
              <Link href="/admin/franchise" className="text-rk-ink no-underline cursor-pointer" aria-label="관리자">⚙</Link>
            </div>
          </div>
          {/* 전화 / 카톡 — 한 줄에 들어가도록. 네이버 진단 도구용 onmousedown 정적 속성 (raw HTML) */}
          <div className="bg-rk-navy text-white px-3 py-2 flex items-center gap-1.5 text-[13px]">
            <span
              dangerouslySetInnerHTML={{
                __html: rawAnchorHtml({
                  href: `tel:${partner.hotlineNumber.replace(/[^\d+]/g, "")}`,
                  conv: "custom001",
                  className: "flex items-center gap-1 no-underline text-white cursor-pointer whitespace-nowrap shrink-0",
                  innerHtml: `<span class="text-[14px]">📞</span><b class="text-[14px] tracking-[.02em] rk-num">${partner.hotlineNumber}</b>`,
                }),
              }}
            />
            <span className="text-[12px] opacity-70 whitespace-nowrap hidden sm:inline">평일 09–22시</span>
            <div className="ml-auto flex gap-1 shrink-0">
              {partner.kakaoChannelUrl ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: rawAnchorHtml({
                      href: partner.kakaoChannelUrl,
                      conv: "custom002",
                      target: "_blank",
                      rel: "noreferrer",
                      className: "bg-white/15 hover:bg-white/25 px-2 py-1 rounded text-[12px] font-medium no-underline text-white cursor-pointer whitespace-nowrap",
                      innerHtml: "카톡상담",
                    }),
                  }}
                />
              ) : (
                <span
                  dangerouslySetInnerHTML={{
                    __html: rawAnchorHtml({
                      href: `tel:${partner.hotlineNumber.replace(/[^\d+]/g, "")}`,
                      conv: "custom001",
                      className: "bg-white/15 hover:bg-white/25 px-2 py-1 rounded text-[12px] font-medium no-underline text-white cursor-pointer whitespace-nowrap",
                      innerHtml: "카톡상담",
                    }),
                  }}
                />
              )}
            </div>
          </div>
          <NavTabs partnerCode={partner.partnerCode} />
        </header>

        {/* Seller-specific banner */}
        {seller && (
          <div className="bg-rk-tint-orange px-4 py-2.5 border-b border-[#F4DCC9] flex items-center gap-2 text-[14px]">
            <span className="bg-rk-orange text-white text-[12px] font-semibold px-1.5 py-0.5 rounded">담당자</span>
            <span className="text-rk-orange-deep">
              <b>{seller.name}</b>이(가) 직접 안내해드립니다.
            </span>
            <a className="ml-auto text-[13px] text-rk-orange-deep font-mono no-underline">{partner.hotlineNumber}</a>
          </div>
        )}

        {/* 렌탈지원금 promo 띠 — 협력점이 ON 한 경우만 (강조 버전). 클릭 → 추천 상품 영역 스크롤.
            displayConfig.flagshipBannerEnabled === false 면 노출 안 함.
            heroSlides 가 비어있는 경우 (자동 슬라이드 OFF) 에도 picks/ranking 의 maxRentalSupport 로 판단. */}
        {data.flagshipBannerEnabled && (() => {
          const pool = heroSlides.length > 0
            ? heroSlides
            : [...picks, ...ranking, ...(hero ? [hero] : [])];
          return pool.some(p => p.maxRentalSupport > 0);
        })() && (
          <a
            href="#picks"
            className="relative overflow-hidden bg-gradient-to-r from-[#FF6B2C] via-[#F26A1F] to-[#E04B0B] text-white px-4 py-3.5 flex items-center gap-3 no-underline cursor-pointer hover:brightness-105 active:brightness-95 transition-[filter] duration-150"
            style={{ boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.12)" }}
          >
            {/* 반짝이 효과 */}
            <span
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background: "repeating-linear-gradient(45deg, transparent 0 8px, rgba(255,255,255,.15) 8px 16px)",
              }}
            />
            <span className="text-[28px] leading-none relative">🎁</span>
            <div className="flex-1 leading-tight relative min-w-0">
              <div className="text-[11px] font-medium tracking-[.08em] opacity-90">FLAGSHIP CASHBACK</div>
              <div className="text-[17px] font-extrabold tracking-[-.02em] mt-px whitespace-nowrap">
                개통 시 <span className="text-[22px] rk-num">+{(() => {
                  const pool = heroSlides.length > 0
                    ? heroSlides
                    : [...picks, ...ranking, ...(hero ? [hero] : [])];
                  const n = Math.max(0, ...pool.map(p => p.maxRentalSupport));
                  return n % 10000 === 0 ? `${n / 10000}만원` : `${fmt(n)}원`;
                })()}</span> 현금 캐시백
              </div>
              <div className="text-[12px] opacity-90 mt-0.5">
                협력점 단독 혜택 · 모든 상품 적용 · 가입 취소 시 전액 환수
              </div>
            </div>
            <span className="inline-block bg-white text-rk-orange-deep px-2.5 py-1 rounded-full text-[12px] font-bold relative whitespace-nowrap shrink-0">
              혜택 보기 ↓
            </span>
          </a>
        )}

        {/* Hero 슬라이더 — 활성 이벤트 배너(앞쪽) + 상품 슬라이드(뒤쪽) 통합 회전 */}
        {(heroSlides.length > 0 || data.banners.length > 0) && (
          <HeroCarousel
            items={heroSlides}
            banners={data.banners}
            partnerName={partner.partnerName}
            sellerName={seller?.name}
            partnerCode={partner.partnerCode}
          />
        )}

        {/* QUICK nav 비활성 — 아래 카테고리 랭킹 탭과 중복되어 제거. 필요 시 주석 복구. */}

        <div className="bg-rk-tint-orange px-3.5 py-2 text-[14px] text-rk-orange-deep flex items-center gap-1.5 border-b border-[#F4DCC9]">
          <span className="text-sm">🚚</span>
          <span><b className="font-semibold">오늘 신청 → 최단 {nextInstallLabel()} 설치 가능</b> · {partner.region} 한정</span>
        </div>

        {/* 실시간 접수 현황 띠배너 — 설치 가능 띠 아래에 배치 (혜택 → 설치 가능 → 실시간 접수 순) */}
        {data.liveActivities.length > 0 && (
          <LiveActivityStrip items={data.liveActivities} />
        )}

        {/* 카테고리 랭킹 — 탭 클릭 시 즉시 변경 (RankingTabs가 내부에서 처리) */}
        <RankingTabs
          partnerCode={partner.partnerCode}
          categories={data.categories}
          rankingsByCategory={data.rankingsByCategory}
        />

        {/* 이벤트 단축 박스 비활성 — 추후 다시 켤 때 주석 풀면 됨 */}

        <section id="picks" className="bg-white px-4 pt-4.5 pb-4 border-b-8 border-rk-soft scroll-mt-4">
          <div className="flex justify-between items-baseline mb-3">
            <div>
              <h2 className="text-[17px] font-bold tracking-[-.02em] m-0 text-rk-ink">매니저 추천 상품</h2>
              <small className="text-[13px] text-rk-muted block mt-0.5">
                {seller?.name ?? partner.partnerName}이(가) 직접 큐레이션 · {new Date().getMonth() + 1}월
                {(() => { const c = commonCondition(picks); return c ? ` · ${c}` : ""; })()}
              </small>
            </div>
            <Link href={`/p/${partner.partnerCode}/products`} className="text-[14px] text-rk-muted no-underline cursor-pointer">전체 →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {picks.map((p, i) => (
              <PickCard
                key={p.productCode}
                product={p}
                bg={PICK_BG[i % PICK_BG.length]}
                href={productHref(p.productCode)}
              />
            ))}
          </div>
        </section>

        {/* 후기 캐러셀 + 신뢰 요소 + 듀얼 CTA — 동적 후기 데이터 기반 */}
        {data.reviews.length > 0 && (
          <ReviewCarousel reviews={data.reviews} partnerCode={partner.partnerCode} />
        )}

        <footer className="bg-rk-soft px-3.5 py-4 text-[13px] text-rk-muted leading-[1.7]">
          {partner.brandGuardVideoUrl && (
            <div className="mb-3">
              <video src={partner.brandGuardVideoUrl} autoPlay loop muted playsInline aria-label="SK매직 정품 인증 BRAND GUARD" className="w-full max-w-[360px] mx-auto block rounded-md" />
            </div>
          )}
          <div className="flex gap-2.5 flex-wrap mb-2.5 text-[13px]">
            <Link href="/legal/terms" className="text-rk-ink font-semibold no-underline cursor-pointer">이용약관</Link>
            <Link href="/legal/privacy" className="text-rk-ink font-semibold no-underline cursor-pointer">개인정보처리방침</Link>
            <Link href={`/p/${partner.partnerCode}/help`} className="text-rk-text no-underline cursor-pointer">고객센터</Link>
            <Link href={`/p/${partner.partnerCode}/help`} className="text-rk-text no-underline cursor-pointer">설치 A/S</Link>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 m-0">
            <dt className="text-rk-faint m-0">상호</dt><dd className="m-0">{partner.companyName}</dd>
            {partner.ownerName && <><dt className="text-rk-faint m-0">대표</dt><dd className="m-0">{partner.ownerName}</dd></>}
            {partner.address && <><dt className="text-rk-faint m-0">주소</dt><dd className="m-0">{partner.address}</dd></>}
            {partner.businessNumber && <><dt className="text-rk-faint m-0">사업자</dt><dd className="m-0 rk-num">{partner.businessNumber}</dd></>}
            {partner.commerceNumber && <><dt className="text-rk-faint m-0">통신판매</dt><dd className="m-0 rk-num">{partner.commerceNumber}</dd></>}
            {partner.hotlineNumber && partner.hotlineNumber !== HQ_HOTLINE && (
              <><dt className="text-rk-faint m-0">고객센터</dt><dd className="m-0 rk-num">{partner.hotlineNumber} (평일 09:00–22:00)</dd></>
            )}
          </dl>
        </footer>

        <div id="consult-form" className="sticky bottom-0 px-3.5 py-2.5 bg-white border-t border-rk-line flex gap-2 items-center z-10">
          {partner.kakaoChannelUrl ? (
            <span
              className="flex-1 contents"
              dangerouslySetInnerHTML={{
                __html: rawAnchorHtml({
                  href: partner.kakaoChannelUrl,
                  conv: "custom002",
                  target: "_blank",
                  rel: "noreferrer",
                  className: "flex-1 bg-[#FEE500] hover:bg-[#F4DC00] text-[#1A1D24] py-3 rounded-lg font-bold text-[13px] text-center flex gap-1.5 items-center justify-center no-underline cursor-pointer",
                  innerHtml: "💬 카톡 문의",
                }),
              }}
            />
          ) : (
            <span
              className="flex-1 contents"
              dangerouslySetInnerHTML={{
                __html: rawAnchorHtml({
                  href: `tel:${(seller?.phone?.trim() || partner.hotlineNumber).replace(/[^\d+]/g, "")}`,
                  conv: "custom001",
                  className: "flex-1 bg-[#FEE500] hover:bg-[#F4DC00] text-[#1A1D24] py-3 rounded-lg font-bold text-[13px] text-center flex gap-1.5 items-center justify-center no-underline cursor-pointer",
                  innerHtml: "📞 지금 전화상담",
                }),
              }}
            />
          )}
          <ConsultForm
            partnerCode={partner.partnerCode}
            partnerName={partner.partnerName}
            sellerCode={seller?.sellerCode}
            sellerName={seller?.name}
          />
        </div>
      </div>

      <aside className="hidden w-[220px] sticky top-8 text-[14px] text-rk-muted leading-[1.65]">
        <h6 className="text-[13px] text-rk-faint tracking-[.12em] uppercase mb-2">이 협력점의 차별화</h6>
        {picks.filter(p => p.giftAmount > 0).length === 0 ? (
          <span>현재 활성 사은품 정책 없음</span>
        ) : (
          picks
            .filter(p => p.giftAmount > 0)
            .map(p => (
              <div key={p.productCode} className="border-b border-rk-line-2 pb-2 mb-2">
                <b className="text-rk-ink block">{p.modelName}</b>
                <span className="text-rk-orange-deep font-medium block">사은품 ─ {p.giftLabel}</span>
                <small className="text-rk-muted">대당 -₩{fmt(p.giftAmount)} 환원</small>
              </div>
            ))
        )}
        <small className="block mt-3">⚠ 다른 협력점은 다른 사은품/할인을 운영합니다 — 좌측 사이드바에서 비교해보세요.</small>
      </aside>
    </div>
  );
}

/* ============ Sub-components ============ */
function RankCard({ rank, product, bg, href }: { rank: number; product: ConsumerProduct; bg: string; href: string }) {
  return (
    <Link href={href} className="grid grid-cols-[96px_1fr] gap-3 no-underline text-inherit cursor-pointer">
      <div
        className="aspect-square rounded-lg relative overflow-hidden bg-rk-soft-2"
        style={product.imageUrl ? undefined : { backgroundImage: bg }}
      >
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        )}
        <span className={"absolute top-0 left-0 text-white px-1.5 py-0.5 text-[13px] font-semibold font-mono rounded-br-md rk-num z-10 " + (rank <= 2 ? "bg-rk-sale" : "bg-rk-navy")}>
          {rank}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-[13px] text-rk-muted">SK매직</div>
        <h4 className="text-[13px] font-medium leading-[1.4] text-rk-ink m-0">{product.name}</h4>
        <div className="text-[12px] text-rk-faint font-mono mt-0.5">{product.modelName}</div>
        <div className="flex flex-wrap gap-0.5 mt-1">
          <span className="text-[12px] px-1 py-px rounded bg-rk-soft text-rk-muted">의무 {product.contractPeriod}개월</span>
          <span className="text-[12px] px-1 py-px rounded bg-rk-soft text-rk-muted">{managementLabel(product)}</span>
          {product.giftLabel && (
            <span className="text-[12px] px-1 py-px rounded bg-rk-tint-orange text-rk-orange-deep font-medium">사은품 {product.giftLabel}</span>
          )}
        </div>
        {/* 기준가 (있고 effective 와 다를 때) — 취소선 */}
        {product.baseRentalPrice != null && product.baseRentalPrice > product.rentalPrice && (
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[11px] text-rk-faint">기준가</span>
            <span className="text-[12px] text-rk-faint line-through rk-num">월 {fmt(product.baseRentalPrice)}원</span>
          </div>
        )}
        {/* effective 월요금 (= promo ?? 운영가) — 헤드라인 */}
        <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[12px] text-rk-muted">
            {product.promoApplied ? "🏷️ 전사할인가" : "월 렌탈가"}
          </span>
          <span className="text-base font-bold text-rk-ink tracking-[-.02em] rk-num">
            {fmt(product.rentalPrice)}<small className="text-[13px] font-medium">원~</small>
          </span>
        </div>
        {product.promotionBadge && (
          <div className="mt-1">
            <span className="inline-block bg-rk-orange text-white px-2 py-0.5 rounded-md font-bold text-[11px] whitespace-nowrap">
              {product.promotionBadge}
            </span>
          </div>
        )}
        {product.cardDiscountPrice != null && (
          <div className="text-[12px] text-rk-muted mt-px">
            카드할인 시 최대 <b className="text-rk-sale rk-num">월 {fmt(product.cardDiscountPrice)}원~</b>
          </div>
        )}
        {product.minRivalPrice != null && product.minRivalPrice > 0 && (
          product.rivalHalfPrice != null && product.rivalHalfMonths > 0 ? (
            <div className="text-[11px] text-rk-orange-deep mt-px">
              🔥 첫 {product.rivalHalfMonths}개월 반값 월 <b className="rk-num">{fmt(product.rivalHalfPrice)}원~</b>
              <span className="text-rk-faint"> · 이후 {fmt(product.minRivalPrice)}원 (카드 별도)</span>
            </div>
          ) : (
            <div className="text-[11px] text-rk-orange-deep mt-px">
              🔄 타사 적용시 월 <b className="rk-num">{fmt(product.minRivalPrice)}원~</b> <span className="text-rk-faint font-normal">(카드 별도)</span>
            </div>
          )
        )}
      </div>
    </Link>
  );
}

function PickCard({ product, bg, href }: { product: ConsumerProduct; bg: string; href: string }) {
  const savings = product.cardDiscountPrice != null ? product.rentalPrice - product.cardDiscountPrice : 0;
  return (
    <Link
      href={href}
      className="no-underline text-inherit cursor-pointer block group transition-transform duration-150 hover:-translate-y-0.5"
    >
      <div
        className="aspect-square rounded-lg relative overflow-hidden bg-rk-soft-2 shadow-[0_1px_2px_rgba(20,25,40,0.04)] group-hover:shadow-[0_4px_12px_rgba(20,25,40,0.08)] transition-shadow"
        style={product.imageUrl ? undefined : { backgroundImage: bg }}
      >
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        )}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5 items-start z-10">
          {product.isNew && <span className="text-[9px] px-1 py-px rounded text-white font-bold bg-rk-orange-deep">NEW</span>}
          {product.giftAmount > 0 && <span className="text-[9px] px-1 py-px rounded text-white font-semibold bg-rk-orange">사은품</span>}
          {product.isFeatured && <span className="text-[9px] px-1 py-px rounded text-white font-semibold bg-rk-navy">MD추천</span>}
        </div>
        {/* 렌탈지원금 캐시백 배지 — 강조 */}
        {product.maxRentalSupport > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-gradient-to-r from-rk-success to-[#0F7C3C] text-white text-[10px] px-2 py-1 rounded-md font-extrabold rk-num z-10 shadow-md animate-pulse-cashback">
            💰 +{fmt(product.maxRentalSupport)}원
          </div>
        )}
        {savings > 0 && (
          <div className="absolute bottom-1.5 right-1.5 bg-rk-sale text-white text-[9px] px-1.5 py-0.5 rounded font-bold rk-num z-10">
            카드 −{fmt(savings)}원
          </div>
        )}
      </div>
      <div className="text-[13px] text-rk-muted mt-2">SK매직</div>
      <h4 className="text-[13px] font-medium text-rk-ink leading-[1.4] m-0 mt-0.5 line-clamp-2 min-h-[36px]">{product.name}</h4>
      <div className="text-[12px] text-rk-faint font-mono mt-0.5 truncate">{product.modelName}</div>
      {product.baseRentalPrice != null && product.baseRentalPrice > product.rentalPrice && (
        <small className="block text-[11px] text-rk-faint line-through rk-num mt-1">월 {fmt(product.baseRentalPrice)}원</small>
      )}
      <div className="mt-0.5 flex items-baseline gap-1">
        <small className="text-[11px] text-rk-muted">{product.promoApplied ? "🏷️ 전사할인가" : "월"}</small>
        <b className="text-[16px] font-bold tracking-[-.02em] text-rk-ink rk-num">{fmt(product.rentalPrice)}<small className="text-[13px] font-medium">원~</small></b>
      </div>
      {product.promotionBadge && (
        <div className="mt-1">
          <span className="inline-block bg-rk-orange text-white px-2 py-0.5 rounded-md font-bold text-[11px] whitespace-nowrap">
            {product.promotionBadge}
          </span>
        </div>
      )}
      {product.cardDiscountPrice != null && (
        <div className="mt-px text-[12px] text-rk-sale font-medium">
          카드 최대 <b className="font-bold rk-num">월 {fmt(product.cardDiscountPrice)}원</b>
        </div>
      )}
      {product.minRivalPrice != null && product.minRivalPrice > 0 && (
        product.rivalHalfPrice != null && product.rivalHalfMonths > 0 ? (
          <div className="mt-px text-[11px] text-rk-orange-deep font-medium leading-tight">
            🔥 첫 {product.rivalHalfMonths}개월 반값 월 <b className="rk-num">{fmt(product.rivalHalfPrice)}원~</b>
            <span className="block text-rk-faint font-normal">이후 {fmt(product.minRivalPrice)}원 (카드 별도)</span>
          </div>
        ) : (
          <div className="mt-px text-[11px] text-rk-orange-deep font-medium">
            🔄 타사 적용시 월 <b className="rk-num">{fmt(product.minRivalPrice)}원~</b> <span className="text-rk-faint font-normal">(카드 별도)</span>
          </div>
        )
      )}
      {/* 의무·관리방식 칩은 섹션 헤더로 통합 → 카드 공간 절약 */}
      {product.giftLabel && <div className="text-[12px] text-rk-orange-deep font-medium mt-1.5 truncate">🎁 {product.giftLabel}</div>}
    </Link>
  );
}
