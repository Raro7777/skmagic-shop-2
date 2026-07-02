"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ConsumerProduct, ActiveBanner } from "@/lib/partnerSite";
import { SK_MAGIC_LOGO } from "@/lib/constants/assets";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const ROTATE_MS = 4500;

type Slide =
  | { kind: "product"; product: ConsumerProduct }
  | { kind: "banner"; banner: ActiveBanner };

export default function HeroCarousel({
  items,
  banners,
  partnerName,
  sellerName,
  partnerCode,
  showBrandCertification = true,
}: {
  items: ConsumerProduct[];
  banners?: ActiveBanner[];
  partnerName: string;
  sellerName?: string;
  partnerCode: string;
  showBrandCertification?: boolean;
}) {
  const slides: Slide[] = [
    ...(banners ?? []).map(b => ({ kind: "banner" as const, banner: b })),
    ...items.map(p => ({ kind: "product" as const, product: p })),
  ];
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // 터치 스와이프 — 가로 이동량 > SWIPE_THRESHOLD 이고 |dx| > |dy| 이면 이전/다음 슬라이드.
  const SWIPE_THRESHOLD = 50;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    setPaused(true);
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s || slides.length < 2) { setPaused(false); return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) setIdx(i => (i + 1) % slides.length);
      else setIdx(i => (i - 1 + slides.length) % slides.length);
    }
    // 자동 회전 재개 (UX: 스와이프 직후 2.5초간만 유지하고 싶다면 setTimeout 사용 가능)
    setPaused(false);
  };

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length, paused]);

  useEffect(() => {
    const c = slides[idx];
    if (!c || c.kind !== "banner") return;
    const bid = c.banner.id;
    try {
      const blob = new Blob([JSON.stringify({ bannerId: bid, eventType: "impression" })], { type: "application/json" });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/banner-events", blob);
      } else {
        void fetch("/api/banner-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bannerId: bid, eventType: "impression" }), keepalive: true });
      }
    } catch { /* noop */ }
  }, [idx, slides]);

  if (slides.length === 0) return null;
  const cur = slides[idx] ?? slides[0];
  const total = slides.length;

  // image-only 레이아웃 — 텍스트/CTA 모두 hide, 풀-블리드 이미지만.
  // 캐러셀 indicator/카운트는 유지 (네비게이션 필요).
  const isImageOnly = cur.kind === "banner" && cur.banner.layout === "image-only";

  const sectionStyle: React.CSSProperties = cur.kind === "banner"
    ? { background: `linear-gradient(135deg, ${cur.banner.bgColor1}, ${cur.banner.bgColor2})`, color: cur.banner.textColor }
    : { backgroundImage: "radial-gradient(ellipse at 110% 110%, rgba(242,106,31,.4), transparent 50%)" };
  // 모든 슬라이드 750:1000 비율 (3:4) 로 통일. 너비 100% 에 맞춰 세로 자동.
  // 이미지 배너 (image-only / image-bg) 가 잘리지 않고 꽉 차게.
  const sectionClass = cur.kind === "banner"
    ? "relative overflow-hidden aspect-[3/4] flex flex-col touch-pan-y select-none"
    : "relative bg-rk-navy text-white overflow-hidden aspect-[3/4] flex flex-col touch-pan-y select-none";

  const slideKey = cur.kind === "banner" ? `banner-${cur.banner.id}` : `product-${cur.product.productCode}`;
  const productHrefBase = `/p/${partnerCode}/products`;

  // image-only 는 클릭으로 ctaHref 이동 + 노출 통계만 추적
  if (isImageOnly && cur.kind === "banner") {
    return (
      <ImageOnlySlide
        banner={cur.banner}
        slides={slides}
        idx={idx}
        setIdx={setIdx}
        total={total}
        paused={paused}
        setPaused={setPaused}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
    );
  }

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={sectionClass}
      style={sectionStyle}
    >
      {/* SK magic 인증 배지 — 우측 상단 고정. 렌탈지원금 노출 컨텍스트에서 숨김 (본사 신뢰도 보호). */}
      {showBrandCertification && (
        <div className="absolute top-3 right-3 z-[5] flex items-center gap-1.5 bg-white px-2 py-1 rounded-md shadow-sm">
          <img src={SK_MAGIC_LOGO} alt="SK magic 공식" className="h-[18px] w-auto" />
          <span className="text-[10px] font-bold text-rk-ink leading-none">공식 인증</span>
        </div>
      )}

      <div key={slideKey} className="hero-slide-fade flex-1 flex flex-col">
        {cur.kind === "product" ? (
          <ProductSlide product={cur.product} hrefBase={productHrefBase} partnerName={partnerName} sellerName={sellerName} />
        ) : (
          <BannerSlideContent banner={cur.banner} />
        )}
      </div>

      {/* indicator + count — 하단 고정 */}
      <div className="absolute left-4 right-4 bottom-3.5 flex justify-between items-center z-[6]">
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`슬라이드 ${i + 1}`}
              onClick={() => setIdx(i)}
              className={
                "h-1.5 rounded-full transition-all border-0 cursor-pointer p-0 " +
                (i === idx ? "bg-white w-3.5" : "bg-white/25 w-1.5 hover:bg-white/50")
              }
            />
          ))}
        </div>
        <span className="text-[13px] font-mono opacity-80 px-2 py-0.5 bg-black/30 rounded-full text-white rk-num">
          {idx + 1} / {total}
        </span>
      </div>

      <style jsx>{`
        .hero-slide-fade {
          animation: hero-fade 600ms ease-out;
        }
        @keyframes hero-fade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

/* ─────────────────── 상품 슬라이드 — 3구역 ─────────────────── */
function ProductSlide({
  product,
  hrefBase,
  partnerName,
  sellerName,
}: {
  product: ConsumerProduct;
  hrefBase: string;
  partnerName: string;
  sellerName?: string;
}) {
  return (
    <Link href={`${hrefBase}/${product.productCode}`} className="block no-underline flex-1 flex flex-col" style={{ color: "inherit" }}>
      {/* 상단 — 배지 + 타이틀 (2줄 max) */}
      <div className="pt-[22px] px-4">
        <span className="inline-flex gap-1.5 items-center text-[13px] px-2 py-0.5 bg-white/10 rounded-full font-medium mb-2.5">
          {sellerName ?? partnerName} 단독 프로모션
        </span>
        <h2 className="text-[22px] font-bold leading-[1.25] tracking-[-.03em] m-0 text-white line-clamp-2">
          {product.name}
        </h2>
        <p className="text-[14px] text-[#FFB374] mt-1 m-0">
          의무 {product.contractPeriod / 12}년 · {product.managementType}
        </p>
      </div>

      {/* 중단 — 가격 강조 영역 (충분한 여백) */}
      <div className="flex-1 px-4 py-5 flex flex-col justify-center">
        <span className="text-[13px] opacity-70 mb-1">월 렌탈가 최저</span>
        <div className="text-[32px] font-bold tracking-[-.02em] text-[#FFB374] rk-num leading-none">
          {fmt(product.rentalPrice)}<small className="text-[15px] font-medium">원~</small>
        </div>
        <p className="text-[13px] opacity-80 mt-2 m-0 line-clamp-1">
          {product.giftLabel
            ? `${product.giftLabel} 증정 · 카드 36개월 무이자`
            : "신용카드 36개월 무이자 · 무료설치"}
        </p>
      </div>

      {/* 하단 — 메타 칩 안정감 있게 정렬 */}
      <div className="px-4 pb-12">
        <div className="flex gap-1 flex-wrap">
          {product.cardDiscountPrice != null && (
            <span className="text-[12px] px-1.5 py-0.5 bg-white/10 rounded">
              카드 최대 월 {fmt(product.cardDiscountPrice)}원
            </span>
          )}
          <span className="text-[12px] px-1.5 py-0.5 bg-white/10 rounded">의무사용 {product.contractPeriod}개월</span>
          <span className="text-[12px] px-1.5 py-0.5 bg-white/10 rounded">전국 무료설치</span>
          {product.giftAmount > 0 && product.giftLabel && (
            <span className="text-[12px] px-1.5 py-0.5 bg-rk-orange rounded font-medium">사은품 {product.giftLabel}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────── 배너 슬라이드 — 5종 레이아웃 / 3구역 ─────────────────── */
function BannerSlideContent({ banner }: { banner: ActiveBanner }) {
  const recordClick = () => {
    try {
      const blob = new Blob([JSON.stringify({ bannerId: banner.id, eventType: "click" })], { type: "application/json" });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/banner-events", blob);
      } else {
        void fetch("/api/banner-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bannerId: banner.id, eventType: "click" }), keepalive: true });
      }
    } catch { /* noop */ }
  };

  const Wrap = ({ children }: { children: React.ReactNode }) =>
    banner.ctaHref ? (
      <Link href={banner.ctaHref} onClick={recordClick} className="block no-underline flex-1 flex flex-col" style={{ color: "inherit" }}>
        {children}
      </Link>
    ) : (
      <div className="flex-1 flex flex-col">{children}</div>
    );

  // ─── layout=html — 협력점 자유 마크업 (텍스트가 이미 포함됨) ───
  if (banner.layout === "html" && banner.htmlContent) {
    return (
      <Wrap>
        <div
          className="banner-html relative flex-1"
          dangerouslySetInnerHTML={{ __html: banner.htmlContent }}
        />
      </Wrap>
    );
  }

  // ─── layout=image-bg — 풀-블리드 배경 + 텍스트 overlay (텍스트 있을 때만) ───
  if (banner.layout === "image-bg") {
    const hasOverlay = (banner.title?.trim().length ?? 0) > 0;
    return (
      <Wrap>
        <div className="relative flex-1 w-full">
          {banner.imageUrl && (
            <img src={banner.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {hasOverlay && (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10 pointer-events-none" />
              <div className="absolute inset-0 flex flex-col" style={{ color: banner.textColor }}>
                {/* 상단 — 타이틀 */}
                <div className="pt-[22px] px-4">
                  <h2 className="text-[22px] font-bold leading-[1.25] tracking-[-.03em] m-0 line-clamp-2" style={{ textShadow: "0 2px 6px rgba(0,0,0,.4)", color: "inherit" }}>
                    {banner.title}
                  </h2>
                  {banner.subtitle && (
                    <p className="text-[13px] opacity-95 mt-1.5 m-0 leading-[1.4] line-clamp-1" style={{ textShadow: "0 1px 4px rgba(0,0,0,.4)" }}>{banner.subtitle}</p>
                  )}
                </div>
                {/* 중단 — flex spacer (이미지 부분 자연 노출) */}
                <div className="flex-1" />
                {/* 하단 — CTA */}
                {banner.ctaLabel && (
                  <div className="px-4 pb-12">
                    <span className="inline-block px-3.5 py-1.5 rounded-full text-[14px] font-semibold bg-white text-rk-ink shadow-md">
                      {banner.ctaLabel} →
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Wrap>
    );
  }

  // ─── layout=product-spotlight — 상품 이미지 중앙 강조 ───
  if (banner.layout === "product-spotlight") {
    return (
      <Wrap>
        {/* 상단 — 타이틀 (2줄 max) */}
        <div className="pt-[22px] px-4">
          <h2 className="text-[22px] font-bold leading-[1.25] tracking-[-.03em] m-0 line-clamp-2">
            {banner.title}
          </h2>
          {banner.subtitle && (
            <p className="text-[13px] opacity-90 mt-1.5 m-0 leading-[1.4] line-clamp-1">{banner.subtitle}</p>
          )}
        </div>
        {/* 중단 — 상품 이미지 중앙 (140px) */}
        <div className="flex-1 px-4 py-4 flex items-center justify-center">
          <div className="w-[140px] h-[140px] rounded-lg bg-white/15 grid place-items-center overflow-hidden shadow-lg">
            {(banner.spotlightProductImage || banner.imageUrl) ? (
              <img src={banner.spotlightProductImage ?? banner.imageUrl ?? ""} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[12px] opacity-70 text-center">상품<br />이미지</span>
            )}
          </div>
        </div>
        {/* 하단 — CTA */}
        {banner.ctaLabel && (
          <div className="px-4 pb-12">
            <span className="inline-block px-3 py-1.5 rounded text-[14px] font-semibold bg-white/20">
              {banner.ctaLabel} →
            </span>
          </div>
        )}
      </Wrap>
    );
  }

  // ─── layout=promo-stamp — 스탬프 강조 ───
  if (banner.layout === "promo-stamp") {
    return (
      <Wrap>
        {/* 상단 — subtitle (eyebrow) + 타이틀 */}
        <div className="pt-[22px] px-4 text-center">
          {banner.subtitle && (
            <b className="block text-[13px] uppercase tracking-[.1em] opacity-75 mb-1.5">{banner.subtitle}</b>
          )}
          <h2 className="text-[22px] font-bold leading-[1.2] tracking-[-.03em] m-0 line-clamp-2">
            {banner.title}
          </h2>
        </div>
        {/* 중단 — 스탬프 + 이미지 */}
        <div className="flex-1 px-4 py-3 flex items-center justify-center gap-3">
          {banner.imageUrl && (
            <img src={banner.imageUrl} alt="" className="w-[90px] h-[90px] rounded-md object-cover shrink-0 border border-white/20" />
          )}
          {banner.stampText && (
            <div
              className="inline-block px-4 py-2 rounded-md text-[22px] font-bold tracking-[-.02em]"
              style={{ background: banner.textColor, color: banner.bgColor2 }}
            >
              {banner.stampText}
            </div>
          )}
        </div>
        {/* 하단 — CTA */}
        {banner.ctaLabel && (
          <div className="px-4 pb-12 text-center">
            <span className="inline-block px-3 py-1.5 rounded-full bg-white text-rk-ink text-[14px] font-semibold">
              {banner.ctaLabel} →
            </span>
          </div>
        )}
      </Wrap>
    );
  }

  // ─── layout=classic — 기본 ───
  return (
    <Wrap>
      {/* 상단 — 배지 + 타이틀 */}
      <div className="pt-[22px] px-4">
        <span className="inline-flex gap-1.5 items-center text-[13px] px-2 py-0.5 bg-white/20 rounded-full font-medium mb-2.5">
          🎁 진행중 이벤트
        </span>
        <h2 className="text-[22px] font-bold leading-[1.25] tracking-[-.03em] m-0 line-clamp-2">
          {banner.title}
        </h2>
        {banner.subtitle && (
          <p className="text-[13px] opacity-90 mt-1.5 m-0 leading-[1.4] line-clamp-2">{banner.subtitle}</p>
        )}
      </div>
      {/* 중단 — 썸네일 (있을 때만, 중앙) */}
      <div className="flex-1 px-4 py-3 flex items-center justify-center">
        {banner.imageUrl && (
          <img src={banner.imageUrl} alt="" className="w-[100px] h-[100px] rounded-md object-cover border border-white/20" />
        )}
      </div>
      {/* 하단 — CTA */}
      {banner.ctaLabel && (
        <div className="px-4 pb-12">
          <span className="inline-block px-3 py-1.5 rounded text-[14px] font-semibold bg-white/20">
            {banner.ctaLabel} →
          </span>
        </div>
      )}
    </Wrap>
  );
}

/* ─────────────────── image-only 슬라이드 — 풀-블리드 이미지 + 캐러셀 컨트롤 ─────────────────── */
function ImageOnlySlide({
  banner,
  slides,
  idx,
  setIdx,
  total,
  setPaused,
  onTouchStart,
  onTouchEnd,
}: {
  banner: ActiveBanner;
  slides: Slide[];
  idx: number;
  setIdx: (n: number) => void;
  total: number;
  paused: boolean;
  setPaused: (p: boolean) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}) {
  const recordClick = () => {
    try {
      const blob = new Blob([JSON.stringify({ bannerId: banner.id, eventType: "click" })], { type: "application/json" });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/banner-events", blob);
      } else {
        void fetch("/api/banner-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bannerId: banner.id, eventType: "click" }), keepalive: true });
      }
    } catch { /* noop */ }
  };

  // 750:1000 비율 고정. 부모 section 의 aspect-[3/4] 가 박스 크기 결정,
  // 이미지는 그 박스를 object-cover 로 꽉 채움. 750×1000 원본이면 잘림 없음.
  const inner = (
    <div className="relative w-full h-full">
      {banner.imageUrl ? (
        <img src={banner.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${banner.bgColor1}, ${banner.bgColor2})` }} />
      )}
    </div>
  );

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative overflow-hidden aspect-[3/4] bg-rk-soft touch-pan-y select-none"
    >
      {banner.ctaHref ? (
        <Link href={banner.ctaHref} onClick={recordClick} className="block w-full h-full no-underline">
          {inner}
        </Link>
      ) : (
        inner
      )}

      {/* indicator + count (이미지 위에 떠있어도 시인성 위해 어두운 배경 칩) */}
      <div className="absolute left-4 right-4 bottom-3.5 flex justify-between items-center z-[6]">
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`슬라이드 ${i + 1}`}
              onClick={(e) => { e.preventDefault(); setIdx(i); }}
              className={
                "h-1.5 rounded-full transition-all border-0 cursor-pointer p-0 " +
                (i === idx ? "bg-white w-3.5" : "bg-white/40 w-1.5 hover:bg-white/70")
              }
            />
          ))}
        </div>
        <span className="text-[13px] font-mono opacity-90 px-2 py-0.5 bg-black/40 rounded-full text-white rk-num">
          {idx + 1} / {total}
        </span>
      </div>
    </section>
  );
}
