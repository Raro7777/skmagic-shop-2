"use client";

import { useEffect, useState } from "react";
import type { LiveActivityItem } from "@/lib/partnerSite";

/**
 * 실시간 접수 현황 띠배너 — hero 위에 1줄 자동 롤링.
 * 본사 admin 이 등록한 데모 데이터를 모든 협력점 공통으로 노출.
 * 클릭 시 상담신청 영역으로 부드럽게 스크롤.
 */
export default function LiveActivityStrip({ items }: { items: LiveActivityItem[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 3200);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const cur = items[idx];

  const statusColor =
    cur.status.includes("설치") ? "bg-rk-tint-blue text-rk-info" :
    cur.status.includes("상담") ? "bg-rk-tint-orange text-rk-orange-deep" :
    "bg-rk-tint-green text-rk-success";

  const handleClick = () => {
    if (typeof window === "undefined") return;
    // 상담 CTA 영역으로 scroll — sticky bottom CTA 가 항상 보이지만 picks/상담 영역도 같이 강조
    const target = document.querySelector("#picks");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full block bg-gradient-to-r from-[#1A2B4D] via-[#22335A] to-[#1A2B4D] border-b border-rk-line text-white px-3 py-2 text-[12.5px] font-medium overflow-hidden cursor-pointer border-0 text-left"
      title="실시간 접수 현황 — 클릭 시 상담 영역으로 이동"
    >
      <div className="flex items-center gap-2 max-w-[820px] mx-auto">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-rk-success animate-ping opacity-75"></span>
            <span className="relative rounded-full w-2 h-2 bg-rk-success"></span>
          </span>
          <b className="text-[11.5px] font-bold tracking-[.04em] text-rk-success-bright">실시간 접수</b>
        </span>
        <span className="text-rk-line-2 shrink-0">|</span>
        <div className="flex-1 overflow-hidden">
          <div key={cur.id} className="live-fade flex items-center gap-2 whitespace-nowrap">
            <span className={`shrink-0 text-[10.5px] px-1.5 py-0.5 rounded font-semibold ${statusColor}`}>{cur.status}</span>
            {cur.region && (
              <>
                <span className="text-rk-line shrink-0">·</span>
                <span className="opacity-85 shrink-0">📍 {cur.region}</span>
              </>
            )}
            <span className="text-rk-line shrink-0">·</span>
            <b className="text-white">{cur.customerName}</b>
            <span className="text-rk-line shrink-0">·</span>
            <span className="text-[11px] opacity-65 shrink-0">{cur.minutesAgo}분 전</span>
          </div>
        </div>
        <span className="text-[11px] opacity-70 shrink-0">→</span>
      </div>
      <style jsx>{`
        .live-fade { animation: live-slide 600ms ease-out; }
        @keyframes live-slide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </button>
  );
}
