"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReviewListItem } from "@/lib/partnerSite";

const ROTATE_MS = 5500;

/**
 * 메인 페이지 후기 캐러셀. 자동 회전 + 좌우 인디케이터 + 신뢰 요소
 * ("강남구 설치", "오늘 설치 완료") + 듀얼 CTA (상담받기 / 혜택 확인하기).
 */
export default function ReviewCarousel({
  reviews,
  partnerCode,
}: {
  reviews: ReviewListItem[];
  partnerCode: string;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reviews.length <= 1 || paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % reviews.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [reviews.length, paused]);

  if (reviews.length === 0) return null;
  const cur = reviews[idx];
  const recencyLabel =
    cur.daysAgo === 0 ? "오늘 설치 완료" :
    cur.daysAgo === 1 ? "어제 설치" :
    cur.daysAgo <= 6 ? `${cur.daysAgo}일 전 설치` :
    cur.daysAgo <= 30 ? `${Math.floor(cur.daysAgo / 7)}주 전 설치` :
    `${cur.daysAgo}일 전`;
  const fmtRating = "★".repeat(cur.rating) + "☆".repeat(5 - cur.rating);

  return (
    <section
      className="bg-gradient-to-br from-rk-soft-2 to-white px-4 pt-5 pb-5 border-b-8 border-rk-soft"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[17px] font-bold tracking-[-.02em] m-0 text-rk-ink">실제 설치 후기</h2>
          <small className="text-[12px] text-rk-muted block mt-0.5">최근 30 일 가입자 평균 평점 ★ 4.9</small>
        </div>
        <Link href={`/p/${partnerCode}/reviews`} className="text-[13px] text-rk-muted no-underline cursor-pointer">전체 →</Link>
      </div>

      {/* 후기 카드 — 캐러셀. 좌측 텍스트 + 우측 설치사진 썸네일 */}
      <article key={cur.id} className="review-fade bg-white border border-rk-line rounded-[14px] px-4 py-4 shadow-[0_2px_8px_rgba(20,25,40,0.04)]">
        <div className="flex gap-3">
          {/* 좌측 텍스트 영역 */}
          <div className="flex-1 min-w-0">
            {/* 별점 (강조) */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-rk-warn text-[18px] tracking-[0.1em] leading-none">{fmtRating}</span>
              <span className="text-[13px] font-bold text-rk-ink">{cur.rating.toFixed(1)}</span>
              {cur.isVerified && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-rk-tint-green text-rk-success font-bold rounded shrink-0">✓ 가입 인증</span>
              )}
            </div>
            {/* 후기 본문 */}
            {cur.title && <h4 className="text-[14px] font-semibold m-0 mb-1 text-rk-ink leading-[1.4] line-clamp-1">{cur.title}</h4>}
            <p className="text-[13.5px] text-rk-text m-0 leading-[1.55] line-clamp-3">{cur.body}</p>
          </div>

          {/* 우측 설치사진 썸네일 — installPhotoUrl 또는 photos[0]. 없으면 컬럼 자체 미노출 */}
          {(() => {
            const thumb = cur.installPhotoUrl || cur.photos?.[0] || null;
            if (!thumb) return null;
            return (
              <div className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt="설치 후기 사진"
                  className="w-[96px] h-[96px] object-cover rounded-md border border-rk-line"
                  loading="lazy"
                />
                {cur.photos && cur.photos.length > 1 && (
                  <div className="text-[10px] text-rk-faint mt-1 text-center">+{cur.photos.length - 1}장</div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 신뢰 요소 — 지역·최근 설치 */}
        <div className="flex gap-1.5 flex-wrap mt-3 mb-2">
          {cur.region && <span className="text-[11px] px-1.5 py-0.5 bg-rk-tint-blue text-rk-info font-medium rounded">📍 {cur.region} 설치</span>}
          <span className="text-[11px] px-1.5 py-0.5 bg-rk-tint-orange text-rk-orange-deep font-medium rounded">🕒 {recencyLabel}</span>
        </div>

        {/* 제품명 + 작성자 + 날짜 (위계 하단) */}
        <div className="border-t border-rk-line-2 pt-2.5 mt-2 flex items-center justify-between gap-2 text-[12px] text-rk-faint flex-wrap">
          <span className="truncate">
            <b className="text-rk-muted">{cur.productName ?? "—"}</b>
            {cur.modelName && <span className="font-mono ml-1">({cur.modelName})</span>}
          </span>
          <span className="shrink-0">{cur.customerName} · {cur.daysAgo === 0 ? "오늘" : cur.daysAgo === 1 ? "어제" : `${cur.daysAgo}일 전`}</span>
        </div>
      </article>

      {/* 인디케이터 + 카운트 */}
      <div className="flex justify-center items-center gap-2 mt-3">
        {reviews.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`후기 ${i + 1}`}
            onClick={() => setIdx(i)}
            className={"h-1.5 rounded-full transition-all border-0 cursor-pointer p-0 " + (i === idx ? "bg-rk-orange w-5" : "bg-rk-line-2 w-1.5 hover:bg-rk-muted")}
          />
        ))}
        <span className="text-[11px] text-rk-faint rk-num ml-1.5">{idx + 1} / {reviews.length}</span>
      </div>

      {/* 듀얼 CTA 제거 — 하단 고정바 PartnerCta 와 중복되어 삭제 */}

      <style jsx>{`
        .review-fade { animation: review-slide 500ms ease-out; }
        @keyframes review-slide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
