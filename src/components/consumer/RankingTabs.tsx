"use client";

import Link from "next/link";
import { useState } from "react";
import type { CategoryEntry, ConsumerProduct } from "@/lib/partnerSite";
import ProductThumb from "./ProductThumb";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const PRODUCT_BG: Record<string, string> = {
  water:    "linear-gradient(160deg,#D8E2F0,#A4B4D0)",
  bidet:    "linear-gradient(160deg,#F0E5DA,#D6BFA8)",
  air:      "linear-gradient(160deg,#E5EAEF,#B8C2CD)",
  mattress: "linear-gradient(160deg,#DEE5F0,#A8B5CC)",
  massage:  "linear-gradient(160deg,#F0E8E0,#D0BFAE)",
  dryer:    "linear-gradient(160deg,#E0E5EF,#B8C0D2)",
  kitchen:  "linear-gradient(160deg,#F0E0D8,#D6B8A4)",
};

export default function RankingTabs({
  partnerCode,
  categories,
  rankingsByCategory,
}: {
  partnerCode: string;
  categories: CategoryEntry[];
  rankingsByCategory: Record<string, ConsumerProduct[]>;
}) {
  const defaultSlug = categories[0]?.slug ?? "water";
  const [activeSlug, setActiveSlug] = useState(defaultSlug);
  const products = rankingsByCategory[activeSlug] ?? [];

  if (categories.length === 0) return null;

  return (
    <section className="bg-white pt-3 pb-4 px-4 border-b-8 border-rk-soft">
      <div className="flex items-center mb-2">
        <h3 className="text-[14px] font-semibold text-rk-ink">🏆 카테고리 랭킹</h3>
        <Link
          href={`/p/${partnerCode}/category/${activeSlug}`}
          className="ml-auto text-[13px] text-rk-info no-underline"
        >
          전체 보기 →
        </Link>
      </div>

      {/* Tabs — 모바일 frame 폭에 맞춰 4개 탭이 한 줄에 fit. flex-1 로 동일 폭 */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {categories.map(c => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setActiveSlug(c.slug)}
            className={
              "px-1.5 py-1.5 rounded-full text-[12px] cursor-pointer border transition-colors flex items-center justify-center gap-0.5 min-w-0 " +
              (c.slug === activeSlug
                ? "bg-rk-navy text-white font-medium border-rk-navy"
                : "bg-white text-rk-text border-rk-line hover:bg-rk-soft-2")
            }
          >
            <span className="shrink-0">{c.icon}</span>
            <span className="truncate">{c.label}</span>
            <span className={"text-[11px] shrink-0 " + (c.slug === activeSlug ? "opacity-70" : "text-rk-faint")}>
              {c.count}
            </span>
          </button>
        ))}
      </div>

      {/* Ranking grid */}
      {products.length === 0 ? (
        <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-4 text-center text-[14px] text-rk-muted">
          이 카테고리에 노출 상품이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {products.slice(0, 4).map((p, idx) => (
            <Link
              key={p.productCode}
              href={`/p/${partnerCode}/products/${p.productCode}`}
              className="grid grid-cols-[64px_1fr_auto] gap-3 items-center no-underline text-inherit cursor-pointer p-2 rounded hover:bg-rk-soft-2 transition-colors"
            >
              <div className="relative">
                <ProductThumb
                  imageUrl={p.imageUrl}
                  alt={p.name}
                  fallbackBg={PRODUCT_BG[p.category] ?? PRODUCT_BG.water}
                />
                <span
                  className={
                    "absolute -top-1 -left-1 text-white px-1.5 py-px text-[12px] font-bold font-mono rounded rk-num z-10 " +
                    (idx <= 1 ? "bg-rk-sale" : "bg-rk-navy")
                  }
                >
                  {idx + 1}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-rk-ink leading-[1.35] truncate">{p.name}</div>
                <div className="text-[12px] text-rk-faint font-mono mt-0.5 truncate">{p.modelName} · {p.managementType}</div>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {p.giftLabel && <span className="text-[9px] px-1 py-px rounded bg-rk-tint-orange text-rk-orange-deep font-medium">사은품</span>}
                  {p.installFreed && <span className="text-[9px] px-1 py-px rounded bg-rk-tint-green text-rk-success font-medium">설치비 면제</span>}
                  {p.isFeatured && <span className="text-[9px] px-1 py-px rounded bg-rk-tint-blue text-rk-info font-medium">MD추천</span>}
                  {p.maxRentalSupport > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gradient-to-r from-rk-success to-[#0F7C3C] text-white font-extrabold rk-num shadow animate-pulse-cashback">💰 +{fmt(p.maxRentalSupport)}원</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[12px] text-rk-muted">월</div>
                <b className="text-[15px] font-bold tracking-[-.02em] text-rk-ink rk-num">{fmt(p.rentalPrice)}원~</b>
                {p.cardDiscountPrice && (
                  <div className="text-[12px] text-rk-sale font-medium">카드 {fmt(p.cardDiscountPrice)}원~</div>
                )}
                {p.maxRivalSavings > 0 && (
                  <div className="text-[11px] text-rk-orange-deep font-medium">🔄 타사 −{fmt(p.maxRivalSavings)}원</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
