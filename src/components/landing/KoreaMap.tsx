"use client";

import Link from "next/link";
import { useState } from "react";
import type { LandingPartnerPoint } from "@/lib/landingStats";

/**
 * 한국 광역시도 단순 SVG + 협력점 점멸 ping.
 * 점 클릭 시 해당 협력점 매장 사이트로 진입.
 */
export default function KoreaMap({ points }: { points: LandingPartnerPoint[] }) {
  const [hovered, setHovered] = useState<LandingPartnerPoint | null>(null);

  return (
    <div className="relative bg-rk-navy text-white rounded-xl p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-2 h-2 rounded-full bg-rk-success animate-pulse" />
        <b className="text-[13px] font-semibold">전국 협력점 운영 현황 · LIVE</b>
        <span className="ml-auto text-[10px] text-white/60 rk-num">{points.length}개 점멸 중</span>
      </div>

      <div className="relative">
        <svg viewBox="40 30 160 200" className="w-full h-[420px] block">
          {/* 한국 outline — 단순화 (대략적 모양) */}
          <path
            d="M 95 35 Q 110 32 130 40 L 145 55 L 158 75 L 168 100 L 175 125 L 168 155 L 158 175 L 145 195 L 125 210 L 100 218 L 75 213 L 68 195 L 75 175 L 68 155 L 75 130 L 70 110 L 75 90 L 82 70 L 85 50 Z"
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.6"
          />
          {/* 제주 */}
          <ellipse cx="88" cy="218" rx="14" ry="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" />

          {/* 점멸 ping — 협력점별 */}
          {points.map(p => {
            const intensity = Math.min(1, p.leadsThisMonth / 10);
            const r = 1.6 + intensity * 1.2;
            return (
              <g key={p.partnerCode}>
                {/* outer pulse */}
                <circle cx={p.x} cy={p.y} r={r * 3} fill="rgba(255, 138, 76, 0.25)" className="origin-center">
                  <animate attributeName="r" values={`${r * 2};${r * 4};${r * 2}`} dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
                </circle>
                {/* core */}
                <circle
                  cx={p.x} cy={p.y} r={r}
                  fill="#FF8A4C"
                  stroke="white"
                  strokeWidth="0.4"
                  onMouseEnter={() => setHovered(p)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer transition-all"
                />
              </g>
            );
          })}

          {/* province 라벨 */}
          {["서울","경기","강원","대전","대구","부산","광주","제주"].map(label => {
            const coords: Record<string, { x: number; y: number }> = {
              서울: { x: 95, y: 65 }, 경기: { x: 115, y: 80 }, 강원: { x: 140, y: 58 },
              대전: { x: 105, y: 122 }, 대구: { x: 142, y: 137 }, 부산: { x: 156, y: 168 },
              광주: { x: 88, y: 158 }, 제주: { x: 88, y: 224 },
            };
            const c = coords[label];
            return <text key={label} x={c.x} y={c.y} fill="rgba(255,255,255,0.45)" fontSize="3.2" textAnchor="middle">{label}</text>;
          })}
        </svg>

        {hovered && (
          <Link
            href={`/p/${hovered.partnerCode}`}
            target="_blank"
            className="absolute top-2 right-2 bg-white text-rk-ink rounded-lg p-3 shadow-2xl border border-rk-line text-[11px] no-underline"
          >
            <b className="block text-[13px] mb-0.5">{hovered.partnerName}</b>
            <small className="block text-rk-muted">{hovered.province}</small>
            <div className="mt-1.5 flex gap-3 rk-num">
              <span>이번 달 lead <b className="text-rk-orange-deep">{hovered.leadsThisMonth}</b></span>
              <span>정산 <b className="text-rk-success">{hovered.settledThisMonth}</b></span>
            </div>
            <small className="block text-rk-info mt-1.5">→ 매장 사이트 진입</small>
          </Link>
        )}
      </div>

      {/* 범례 */}
      <div className="mt-2 flex items-center gap-3 text-[10px] text-white/55">
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rk-orange" /> 협력점 (점 크기 = 이번 달 lead 양)
        </span>
        <span className="ml-auto">점 클릭 → 매장 사이트</span>
      </div>
    </div>
  );
}
