"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ConsumerProduct, ActiveBanner } from "@/lib/partnerSite";

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
}: {
  items: ConsumerProduct[];
  banners?: ActiveBanner[];
  partnerName: string;
  sellerName?: string;
  partnerCode: string;
}) {
  // 협력점 활성 배너를 hero 슬라이드 가장 앞에 끼워 넣기 (priority 높은 순)
  const slides: Slide[] = [
    ...(banners ?? []).map(b => ({ kind: "banner" as const, banner: b })),
    ...items.map(p => ({ kind: "product" as const, product: p })),
  ];
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length, paused]);

  if (slides.length === 0) return null;
  const cur = slides[idx] ?? slides[0];
  const total = slides.length;

  // 배너 노출 이벤트 (slide 진입 시 1회) — public endpoint, fire-and-forget
  useEffect(() => {
    if (cur.kind !== "banner") return;
    const bid = cur.banner.id;
    try {
      const blob = new Blob([JSON.stringify({ bannerId: bid, eventType: "impression" })], { type: "application/json" });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/banner-events", blob);
      } else {
        void fetch("/api/banner-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bannerId: bid, eventType: "impression" }), keepalive: true });
      }
    } catch { /* noop */ }
  }, [cur]);

  // 슬라이드별 배경 결정 — banner는 자체 색상, product는 navy + orange radial
  const sectionStyle: React.CSSProperties = cur.kind === "banner"
    ? { background: `linear-gradient(135deg, ${cur.banner.bgColor1}, ${cur.banner.bgColor2})`, color: cur.banner.textColor }
    : { backgroundImage: "radial-gradient(ellipse at 110% 110%, rgba(242,106,31,.4), transparent 50%)" };
  // 모든 슬라이드(상품/배너 5종 레이아웃)의 세로 사이즈 통일 — 사용자 보고 1a
  const sectionClass = cur.kind === "banner"
    ? "relative pt-[22px] px-4 pb-14 overflow-hidden min-h-[220px]"
    : "relative bg-rk-navy text-white pt-[22px] px-4 pb-14 overflow-hidden min-h-[220px]";

  // 슬라이드 콘텐츠
  const slideKey = cur.kind === "banner" ? `banner-${cur.banner.id}` : `product-${cur.product.productCode}`;
  const productHrefBase = `/p/${partnerCode}/products`;

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      className={sectionClass}
      style={sectionStyle}
    >
      {/* SK magic 공식 인증 배지 — 슬라이드 우측 상단. 흰 배경에 컬러 로고 그대로 */}
      <div className="absolute top-3 right-3 z-[5] flex items-center gap-1.5 bg-white px-2 py-1 rounded-md shadow-sm">
        <img src="/sk-magic-logo.png" alt="SK magic 공식" className="h-[18px] w-auto" />
        <span className="text-[10px] font-bold text-rk-ink leading-none">공식 인증</span>
      </div>
      {/* 풀-블리드 레이아웃(image-bg / html)에선 라벨이 위쪽에 빈 공간을 만들어 다른 슬라이드의 잔상처럼 보임 → 숨김 */}
      {cur.kind === "product" && (
        <span className="inline-flex gap-1.5 items-center text-[13px] px-2 py-0.5 bg-white/10 rounded-full font-medium mb-2.5">
          {sellerName ?? partnerName} 단독 프로모션
        </span>
      )}
      {cur.kind === "banner" && cur.banner.layout !== "image-bg" && cur.banner.layout !== "html" && (
        <span className="inline-flex gap-1.5 items-center text-[13px] px-2 py-0.5 bg-white/20 rounded-full font-medium mb-2.5">
          🎁 진행중 이벤트
        </span>
      )}

      <div key={slideKey} className="hero-slide-fade">
        {cur.kind === "product" ? (
          <Link href={`${productHrefBase}/${cur.product.productCode}`} className="block no-underline" style={{ color: "inherit" }}>
            <h2 className="text-[22px] font-bold leading-[1.3] tracking-[-.03em] m-0 mb-1 text-white">
              {cur.product.name}<br />
              <span className="text-[#FFB374]">의무 {cur.product.contractPeriod / 12}년 · {cur.product.managementType}</span>
            </h2>
            <p className="text-[14px] opacity-80 m-0 mb-4 line-clamp-1">
              {cur.product.giftLabel
                ? `${cur.product.giftLabel} 증정 · 카드 36개월 무이자`
                : "신용카드 36개월 무이자 · 무료설치"}
            </p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[13px] opacity-70">월 렌탈가</span>
              <span className="text-[28px] font-bold tracking-[-.02em] text-[#FFB374] rk-num">
                {fmt(cur.product.rentalPrice)}<small className="text-[13px] font-medium">원</small>
              </span>
            </div>
            <div className="flex gap-1 mt-2.5 flex-wrap">
              {cur.product.cardDiscountPrice && (
                <span className="text-[12px] px-1.5 py-0.5 bg-white/10 rounded">
                  카드할인가 월 {fmt(cur.product.cardDiscountPrice)}원
                </span>
              )}
              <span className="text-[12px] px-1.5 py-0.5 bg-white/10 rounded">의무사용 {cur.product.contractPeriod}개월</span>
              <span className="text-[12px] px-1.5 py-0.5 bg-white/10 rounded">전국 무료설치</span>
              {cur.product.giftAmount > 0 && cur.product.giftLabel && (
                <span className="text-[12px] px-1.5 py-0.5 bg-rk-orange rounded font-medium">사은품 {cur.product.giftLabel}</span>
              )}
            </div>
          </Link>
        ) : (
          <BannerSlideContent banner={cur.banner} />
        )}
      </div>

      {/* indicator + count */}
      <div className="absolute left-4 right-4 bottom-3.5 flex justify-between items-center">
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

function BannerSlideContent({ banner }: { banner: ActiveBanner }) {
  const inner = (() => {
    // layout=html — 협력점이 직접 작성한 마크업 (이미 partnerSite에서 sanitize 됨)
    if (banner.layout === "html" && banner.htmlContent) {
      return (
        <div
          className="banner-html relative -mx-4 -mt-[22px] mb-[-56px] min-h-[260px]"
          dangerouslySetInnerHTML={{ __html: banner.htmlContent }}
        />
      );
    }

    if (banner.layout === "image-bg") {
      // 이미지에 텍스트가 이미 들어있으면 title 을 빈 문자열로 두어 시스템 텍스트·그라데이션 안 그리기
      const hasOverlay = (banner.title?.trim().length ?? 0) > 0;
      return (
        <div className="relative -mx-4 -mt-[22px] mb-[-56px] min-h-[260px]">
          {banner.imageUrl && (
            <img src={banner.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {hasOverlay && (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
              <div className="relative px-4 pt-[22px] pb-14" style={{ color: banner.textColor }}>
                <h2 className="text-[22px] font-bold leading-[1.3] tracking-[-.03em] m-0 mb-1.5" style={{ textShadow: "0 2px 6px rgba(0,0,0,.4)", color: "inherit" }}>
                  {banner.title}
                </h2>
                {banner.subtitle && (
                  <p className="text-[13px] opacity-95 m-0 mb-3 leading-[1.4]">{banner.subtitle}</p>
                )}
                {banner.ctaLabel && (
                  <span className="inline-block px-3 py-1.5 rounded-full text-[14px] font-semibold bg-white text-rk-ink">
                    {banner.ctaLabel} →
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      );
    }

    if (banner.layout === "product-spotlight") {
      return (
        <div className="grid grid-cols-[1fr_88px] gap-3 items-center">
          <div>
            <h2 className="text-[22px] font-bold leading-[1.3] tracking-[-.03em] m-0 mb-1.5">
              {banner.title}
            </h2>
            {banner.subtitle && (
              <p className="text-[13px] opacity-90 m-0 mb-2 leading-[1.4]">{banner.subtitle}</p>
            )}
            {banner.ctaLabel && (
              <span className="inline-block px-3 py-1.5 rounded text-[14px] font-semibold bg-white/20">
                {banner.ctaLabel} →
              </span>
            )}
          </div>
          <div className="w-[88px] h-[88px] rounded-md bg-white/15 grid place-items-center overflow-hidden">
            {(banner.spotlightProductImage || banner.imageUrl) ? (
              <img src={banner.spotlightProductImage ?? banner.imageUrl ?? ""} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[12px] opacity-70 text-center">상품<br />이미지</span>
            )}
          </div>
        </div>
      );
    }

    if (banner.layout === "promo-stamp") {
      return (
        <div className="flex items-center gap-3">
          {banner.imageUrl && (
            <img src={banner.imageUrl} alt="" className="w-[72px] h-[72px] rounded-md object-cover shrink-0 border border-white/20" />
          )}
          <div className="flex-1 text-center">
            {banner.subtitle && (
              <b className="block text-[14px] uppercase tracking-[.1em] opacity-75 mb-1">{banner.subtitle}</b>
            )}
            <h2 className="text-[22px] font-bold leading-[1.2] tracking-[-.03em] m-0 mb-2">
              {banner.title}
            </h2>
            {banner.stampText && (
              <div
                className="inline-block px-4 py-2 rounded-md text-[20px] font-bold tracking-[-.02em] mb-2"
                style={{ background: banner.textColor, color: banner.bgColor2 }}
              >
                {banner.stampText}
              </div>
            )}
            {banner.ctaLabel && (
              <div>
                <span className="inline-block px-3 py-1.5 rounded-full bg-white text-rk-ink text-[14px] font-semibold">
                  {banner.ctaLabel} →
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // classic — 이미지 있으면 좌측 썸네일
    return (
      <div className={banner.imageUrl ? "flex items-center gap-3" : ""}>
        {banner.imageUrl && (
          <img src={banner.imageUrl} alt="" className="w-[80px] h-[80px] rounded-md object-cover shrink-0 border border-white/20" />
        )}
        <div className="flex-1">
          <h2 className="text-[22px] font-bold leading-[1.3] tracking-[-.03em] m-0 mb-1.5">
            {banner.title}
          </h2>
          {banner.subtitle && (
            <p className="text-[13px] opacity-90 m-0 mb-3 leading-[1.4]">{banner.subtitle}</p>
          )}
          {banner.ctaLabel && (
            <span className="inline-block px-3 py-1.5 rounded text-[14px] font-semibold bg-white/20">
              {banner.ctaLabel} →
            </span>
          )}
        </div>
      </div>
    );
  })();

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

  return banner.ctaHref ? (
    <Link href={banner.ctaHref} onClick={recordClick} className="block no-underline" style={{ color: "inherit" }}>
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}
