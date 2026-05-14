"use client";

import type { ThemePreset } from "@/lib/themes";

export default function ThemePresetCard({
  preset,
  isCurrent,
  isSelected,
  onSelect,
}: {
  preset: ThemePreset;
  isCurrent: boolean;     // 현재 라이브에 적용된 테마
  isSelected: boolean;    // 사용자가 지금 화면에서 고른 후보
  onSelect: () => void;
}) {
  return (
    <article
      onClick={onSelect}
      className={
        "rounded-lg p-4 cursor-pointer transition-all " +
        (isSelected
          ? "bg-rk-tint-blue border-2 border-rk-info shadow-rk-md"
          : "bg-rk-soft-2 border-2 border-transparent hover:border-rk-line")
      }
    >
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3 className="text-[14px] font-semibold text-rk-ink">{preset.label}</h3>
            {isCurrent && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rk-tint-green text-rk-success">
                적용 중
              </span>
            )}
          </div>
          <p className="text-[12px] text-rk-muted m-0 leading-snug">{preset.tagline}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {preset.chips.map((c, i) => (
            <div
              key={i}
              className="w-5 h-5 rounded border border-rk-line"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* 미니 모바일 프레임 — 실제 컨슈머 UI 추출 */}
      <div data-theme={preset.id} className="bg-white border border-rk-line rounded-[16px] overflow-hidden shadow-sm">
        <header className="bg-white border-b border-rk-line px-3 py-2.5 flex items-center gap-2">
          <span className="w-6 h-6 rounded grid place-items-center text-white text-[10px] font-bold shrink-0" style={{ background: "#F26A1F" }}>SK</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-rk-ink leading-tight truncate">홍길동렌탈</div>
            <div className="text-[10px] text-rk-muted truncate">SK매직 인증판매점</div>
          </div>
          <span className="text-[14px] text-rk-ink">🛒</span>
        </header>

        <div className="bg-rk-navy text-white px-3 py-3.5">
          <span className="inline-block bg-rk-orange text-white text-[10px] font-semibold px-1.5 py-0.5 rounded mb-1.5">
            오늘 단독 사은품 30만원
          </span>
          <div className="text-[14px] font-semibold leading-tight mb-0.5">SK매직 직수형 정수기</div>
          <div className="text-[10px] opacity-80 mb-2">3년 약정 · 등록비 무료</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] line-through opacity-60 rk-num">39,900원</span>
            <span className="text-[18px] font-bold rk-num">29,900<span className="text-[11px] font-normal">원/월</span></span>
          </div>
        </div>

        <div className="bg-rk-soft-2 px-3 py-3">
          <div className="text-[11px] font-semibold text-rk-ink mb-2">이 협력점 추천</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: "공기청정기", price: "32,900", gift: "사은품 20만" },
              { name: "비데",       price: "19,900", gift: "설치비 무료" },
            ].map((p, i) => (
              <div key={i} className="bg-white border border-rk-line rounded-md p-2">
                <div className="bg-rk-tint-orange text-rk-orange-deep text-[9px] font-semibold px-1 py-0.5 rounded inline-block mb-1">
                  {p.gift}
                </div>
                <div className="text-[11px] font-semibold text-rk-ink leading-tight">{p.name}</div>
                <div className="rk-num text-[12px] font-bold text-rk-ink mt-0.5">{p.price}<span className="text-[9px] font-normal text-rk-muted">원/월</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-rk-soft px-3 py-2 text-[10px] text-rk-muted border-t border-rk-line">
          고객센터 <span className="rk-num text-rk-ink font-semibold">1600-2434</span> · 평일 09–22시
        </div>

        <div className="bg-white border-t border-rk-line px-2 py-2 flex gap-1.5">
          <button className="flex-1 py-2 rounded-md font-semibold text-[12px] text-rk-ink" style={{ background: "#FEE500" }}>
            💬 카톡상담
          </button>
          <button className="flex-1 py-2 rounded-md font-semibold text-[12px] text-white bg-rk-orange">
            ✍ 상담신청
          </button>
        </div>
      </div>
    </article>
  );
}
