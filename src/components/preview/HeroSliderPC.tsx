"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HeroSlideProduct } from "@/lib/partnerHero";

const fmt = (n: number) => n.toLocaleString("ko-KR");

type SlideTheme = {
  bg: string;
  accent: string;
  accentSoft: string;
  badge: string;
  ribbonText: string;
};

const THEMES: Record<string, SlideTheme> = {
  "5월 신모델":     { bg: "from-rk-navy via-[#1a2c4d] to-[#0e1830]",  accent: "#FF8A4C", accentSoft: "rgba(255,138,76,0.15)", badge: "bg-rk-orange text-white",        ribbonText: "NEW · 5월 신모델" },
  "타사보상 강추":   { bg: "from-[#2a1b3d] via-[#3d2151] to-[#1f1530]",  accent: "#C4B5FD", accentSoft: "rgba(196,181,253,0.15)", badge: "bg-[#A78BFA] text-[#1f1530]",   ribbonText: "타사 가전 갈아타기" },
  "단독 사은품":     { bg: "from-[#3d2914] via-[#5c3d1c] to-[#291a0a]",  accent: "#FDBA74", accentSoft: "rgba(253,186,116,0.15)", badge: "bg-[#FDBA74] text-[#3d2914]",   ribbonText: "본 매장 한정 혜택" },
  "BEST":         { bg: "from-rk-navy via-rk-ink to-black",          accent: "#FF8A4C", accentSoft: "rgba(255,138,76,0.15)", badge: "bg-rk-orange text-white",        ribbonText: "BEST 추천" },
};

export default function HeroSliderPC({
  slides,
  partnerCode,
  partnerName,
  hotlineNumber,
  rating,
  reviewCount,
}: {
  slides: HeroSlideProduct[];
  partnerCode: string;
  partnerName: string;
  hotlineNumber: string;
  rating: number | null;
  reviewCount: number;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  if (slides.length === 0) return null;
  const current = slides[idx];
  const theme = THEMES[current.badge] ?? THEMES["BEST"];

  const prev = () => setIdx(i => (i - 1 + slides.length) % slides.length);
  const next = () => setIdx(i => (i + 1) % slides.length);

  // 캠페인 마감 (이번 달 마지막 날 기준)
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = Math.max(0, Math.ceil((monthEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

  const cardSavings = current.cardDiscountPrice != null ? current.rentalPrice - current.cardDiscountPrice : 0;

  return (
    <section
      className={"relative bg-gradient-to-br text-white overflow-hidden " + theme.bg}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 백그라운드 — heroImage 가 있으면 우측 절반에 큰 사이즈로 깔리고, 좌측은 dark 그라데이션 오버레이 */}
      {current.heroImage && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute right-0 top-0 h-full w-[60%] bg-no-repeat bg-cover bg-right opacity-90"
            style={{ backgroundImage: `url(${current.heroImage})` }}
          />
          {/* 좌측 dark 그라데이션 — 텍스트 가독성 */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 via-50% to-transparent" />
          {/* 우측 끝에 살짝 어둡게 */}
          <div className="absolute inset-0 bg-gradient-to-l from-black/20 to-transparent" />
        </div>
      )}

      {/* 데코 광원 (heroImage 없을 때만 활성, 또는 약하게) */}
      <div className={"absolute inset-0 pointer-events-none " + (current.heroImage ? "opacity-15" : "opacity-25")}>
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl" style={{ backgroundColor: theme.accent }} />
        <div className="absolute -bottom-40 -left-20 w-[520px] h-[520px] rounded-full blur-3xl" style={{ backgroundColor: theme.accent }} />
      </div>

      {/* 상단 ribbon */}
      <div className="relative bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-2 flex items-center gap-4 text-[11px]">
          <span className="font-bold tracking-[.04em]" style={{ color: theme.accent }}>★ {theme.ribbonText}</span>
          <span className="text-white/55 hidden md:inline">·</span>
          <span className="text-white/70">5월 운영 마감까지 <b className="text-white">D-{daysLeft}</b></span>
          <span className="text-white/55 hidden md:inline">·</span>
          <span className="text-white/70">매월 SK매직 본사 정책 자동 반영</span>
          <span className="ml-auto text-white/55 hidden md:inline">슬라이드 {idx + 1} / {slides.length}</span>
        </div>
      </div>

      <div className="relative max-w-[1280px] mx-auto px-6 py-12 grid grid-cols-[1.4fr_1fr] gap-12 items-center min-h-[560px]">
        {/* LEFT — 풍부한 정보 패널 */}
        <div className="flex flex-col">
          <div className={"inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mb-4 self-start " + theme.badge}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
            {current.badge}
          </div>

          <h1 className="text-[50px] font-bold leading-[1.1] tracking-[-.025em] mb-3">
            {renderCopyForBadge(current)}
          </h1>

          <p className="text-[15px] text-white/75 leading-[1.7] max-w-[540px] mb-5">
            {descForBadge(current, partnerName)}
          </p>

          {/* 가격 패널 — 큰 strip */}
          <div className="bg-white/8 backdrop-blur-sm rounded-xl border border-white/15 p-4 mb-4 max-w-[560px]">
            <div className="flex items-baseline gap-5 flex-wrap">
              <div>
                <small className="block text-[10px] text-white/55 uppercase tracking-[.06em] mb-0.5">월 렌탈가</small>
                <b className="text-[34px] font-bold tracking-[-.025em] rk-num leading-none">
                  ₩{fmt(current.cardDiscountPrice ?? current.rentalPrice)}
                </b>
                {cardSavings > 0 && (
                  <small className="block text-[10px] mt-1" style={{ color: theme.accent }}>
                    카드 할인 −₩{fmt(cardSavings)}원/월 적용
                  </small>
                )}
              </div>
              {current.rivalCompensationPrice != null && (
                <div className="border-l border-white/15 pl-5">
                  <small className="block text-[10px] uppercase tracking-[.06em] mb-0.5" style={{ color: theme.accent }}>타사보상가</small>
                  <b className="text-[28px] font-bold tracking-[-.025em] rk-num leading-none" style={{ color: theme.accent }}>
                    ₩{fmt(current.rivalCompensationPrice)}
                  </b>
                  <small className="block text-[10px] mt-1" style={{ color: theme.accent }}>
                    {current.rivalHalfMonths ? `+ 첫 ${current.rivalHalfMonths}개월 반값` : "월 차액 즉시 할인"}
                  </small>
                </div>
              )}
              {current.giftAmount > 0 && (
                <div className="border-l border-white/15 pl-5">
                  <small className="block text-[10px] uppercase tracking-[.06em] mb-0.5" style={{ color: theme.accent }}>본 매장 사은품</small>
                  <b className="text-[20px] font-bold rk-num leading-none" style={{ color: theme.accent }}>
                    ₩{fmt(current.giftAmount)}
                  </b>
                  {current.giftLabel && <small className="block text-[10px] mt-1 text-white/70">{current.giftLabel}</small>}
                </div>
              )}
            </div>
          </div>

          {/* 혜택 칩 stack */}
          <div className="flex gap-1.5 flex-wrap mb-4">
            <BenefitChip>🚚 전국 무료 설치</BenefitChip>
            <BenefitChip>💳 36개월 무이자</BenefitChip>
            <BenefitChip>📋 7일 청약 철회</BenefitChip>
            <BenefitChip>🛡 SK매직 본사 인증</BenefitChip>
            {rating != null && (
              <BenefitChip>⭐ {rating.toFixed(1)} · 리뷰 {reviewCount}건</BenefitChip>
            )}
          </div>

          {/* CTA */}
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/preview/p/${partnerCode}/products/${current.productCode}`}
              className="bg-rk-orange hover:bg-rk-orange-deep text-white px-6 py-3 rounded-md text-[14px] font-bold no-underline transition-colors shadow-lg"
            >
              상품 자세히 보기 →
            </Link>
            <a href={`tel:${hotlineNumber}`} className="bg-white/10 hover:bg-white/15 text-white px-5 py-3 rounded-md text-[13px] font-medium no-underline border border-white/15">
              📞 {hotlineNumber} 즉시 상담
            </a>
            <a href="#consult" className="bg-transparent hover:bg-white/5 text-white/85 px-3 py-3 rounded-md text-[12px] no-underline">
              상담 신청 폼 →
            </a>
          </div>
        </div>

        {/* RIGHT — 큰 상품 카드 + 카운트다운 */}
        <div className="space-y-3">
          {/* 카운트다운 */}
          <div
            className="rounded-lg p-3 flex items-center justify-between"
            style={{ backgroundColor: theme.accentSoft, border: `1px solid ${theme.accent}40` }}
          >
            <div>
              <small className="block text-[10px] uppercase tracking-[.06em] mb-0.5" style={{ color: theme.accent }}>
                이번 달 마감
              </small>
              <b className="text-[16px] font-semibold text-white">D-{daysLeft} · 다음 달 정책 변경 전</b>
            </div>
            <div className="text-[28px]">⏳</div>
          </div>

          <Link
            href={`/preview/p/${partnerCode}/products/${current.productCode}`}
            className="block bg-white rounded-xl p-3 no-underline shadow-2xl hover:scale-[1.01] transition-transform"
          >
            {(() => {
              // 우선순위: heroImage(고화질 Blob) → imageUrl → 폴백
              const big = current.heroImage ?? current.imageUrl;
              return big ? (
                <div className="aspect-[4/3] bg-rk-soft-2 rounded-lg mb-3 overflow-hidden relative">
                  <img src={big} alt={current.name} className="absolute inset-0 w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-rk-orange text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">▶ {current.badge}</span>
                </div>
              ) : (
                <div className="aspect-[4/3] bg-rk-soft-2 rounded-lg mb-3 grid place-items-center text-[48px] text-rk-faint">📦</div>
              );
            })()}
            <h3 className="text-[18px] font-bold text-rk-ink leading-[1.3] tracking-[-.02em] m-0 px-2">{current.name}</h3>
            <small className="block text-[10px] text-rk-faint font-mono mt-1 px-2">{current.productCode}</small>
            <div className="mt-2.5 pt-2.5 px-2 border-t border-rk-line-2">
              <div className="flex items-baseline justify-between">
                <small className="text-[10px] text-rk-muted">월 렌탈</small>
                <b className="text-[20px] font-bold text-rk-ink tracking-[-.02em] rk-num">
                  ₩{fmt(current.cardDiscountPrice ?? current.rentalPrice)}
                </b>
              </div>
              {current.rivalCompensationPrice != null && (
                <div className="flex items-baseline justify-between mt-1">
                  <small className="text-[10px] text-rk-orange-deep">타사보상가</small>
                  <b className="text-[16px] text-rk-orange-deep rk-num">₩{fmt(current.rivalCompensationPrice)}</b>
                </div>
              )}
            </div>
            <div className="mt-2 mb-1 text-center text-[11px] text-rk-info font-medium">자세히 보기 →</div>
          </Link>

          {/* 사회적 증명 */}
          <div className="bg-white/8 rounded-lg p-3 flex items-center gap-3 border border-white/10">
            <div className="text-[24px]">🛡</div>
            <div className="flex-1">
              <b className="block text-[12px] text-white">SK매직 본사 공식 인증판매점</b>
              <small className="block text-[10px] text-white/55">정책·수수료 본사 검증 완료 · 본 매장에서 가입 시 본사가 직접 인증</small>
            </div>
          </div>
        </div>

        {/* 좌/우 화살표 */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="이전"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 text-white border-0 w-12 h-12 rounded-full grid place-items-center text-[20px] cursor-pointer backdrop-blur"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="다음"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 text-white border-0 w-12 h-12 rounded-full grid place-items-center text-[20px] cursor-pointer backdrop-blur"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* dot indicator + 슬라이드 제목 */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="flex gap-1.5">
            {slides.map((s, i) => (
              <button
                type="button"
                key={i}
                aria-label={`슬라이드 ${i + 1} — ${s.badge}`}
                onClick={() => setIdx(i)}
                className={
                  "h-2 rounded-full transition-all cursor-pointer border-0 " +
                  (i === idx ? "w-10 bg-white" : "w-2 bg-white/40 hover:bg-white/60")
                }
              />
            ))}
          </div>
          <small className="text-[10px] text-white/55 tracking-[.04em]">
            {paused ? "일시정지" : `자동 전환 · 6.5초마다`}
          </small>
        </div>
      )}
    </section>
  );
}

function BenefitChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-white/8 border border-white/15 text-white/85 text-[11px] px-2.5 py-1 rounded-full backdrop-blur">
      {children}
    </span>
  );
}

function renderCopyForBadge(s: HeroSlideProduct) {
  const savings = s.rentalPrice - (s.rivalCompensationPrice ?? s.rentalPrice);
  switch (s.badge) {
    case "5월 신모델":
      return <>{s.name}<br /><span className="text-[#FF8A4C]">5월 신모델 출시</span></>;
    case "타사보상 강추":
      return <>타사 가전 보유 시<br /><span className="text-[#C4B5FD]">월 ₩{savings.toLocaleString("ko-KR")} 추가 할인</span></>;
    case "단독 사은품":
      return <>본 매장 단독 사은품<br /><span className="text-[#FDBA74]">{s.giftLabel ?? "혜택 증정"}</span></>;
    default:
      return <>{s.name}<br /><span className="text-[#FF8A4C]">BEST 추천</span></>;
  }
}

function descForBadge(s: HeroSlideProduct, partnerName: string) {
  switch (s.badge) {
    case "5월 신모델":
      return "SK매직 본사가 이번 달 출시한 최신 모델. 5월 신정책 가격이 그대로 적용되며 첫 가입자에게는 단독 사은품도 함께 발송됩니다.";
    case "타사보상 강추":
      return "기존 정수기·공기청정기·비데 영수증만 보여주시면 가입 즉시 새 가격으로 갈아타집니다. 카드할인은 별개로 추가 적용 — 절약 효과 ‘이중’.";
    case "단독 사은품":
      return `${partnerName} 가입자 한정 사은품. 본사 표준 상품에 협력점이 자체 부담하는 추가 혜택입니다. 이번 달 마감 시 종료.`;
    default:
      return "본 매장 베스트 추천 모델 — 전국 동일 운영가 + 협력점 단독 사은품 + 본사 인증 설치 기사가 직접 방문합니다.";
  }
}
