"use client";

import { useEffect, useState } from "react";
import type { LandingFeedItem } from "@/lib/landingStats";

const fmt = (n: number) => n.toLocaleString("ko-KR");

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export default function LiveFeed({ initial }: { initial: LandingFeedItem[] }) {
  const [items, setItems] = useState(initial);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // 시간 라벨 1분마다 재계산
    const t = setInterval(() => setTick(x => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // 30초마다 fetch 갱신
    let stop = false;
    const refresh = async () => {
      try {
        const r = await fetch("/api/landing/feed", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!stop && Array.isArray(j.feed)) setItems(j.feed);
      } catch { /* noop */ }
    };
    const t = setInterval(refresh, 30_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  void tick;
  return (
    <div className="bg-white border border-rk-line rounded-xl p-4 h-[420px] overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-2 h-2 rounded-full bg-rk-success animate-pulse" />
        <b className="text-[13px] font-semibold text-rk-ink">실시간 운영 피드</b>
        <span className="ml-auto text-[10px] text-rk-muted">30초마다 갱신</span>
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 -mr-1 flex-1">
        {items.length === 0 ? (
          <div className="text-[12px] text-rk-muted py-8 text-center">실시간 활동 데이터 없음</div>
        ) : (
          items.map((it, i) => (
            <div key={i} className={
              "rounded-md px-2.5 py-1.5 border text-[11px] leading-[1.4] " +
              (it.kind === "settled" ? "bg-rk-tint-green border-rk-success/30" : "bg-rk-tint-blue border-rk-info/30")
            }>
              <div className="flex items-baseline gap-1.5">
                {it.kind === "settled"
                  ? <b className="text-rk-success">💸 정산 완료</b>
                  : <b className="text-rk-info">📞 신규 lead</b>}
                <span className="text-rk-muted ml-auto rk-num text-[10px]">{ageLabel(it.ts)}</span>
              </div>
              <div className="mt-0.5 text-rk-ink">
                <b className="text-[12px]">{it.partnerName}</b>
                <span className="text-rk-muted"> · {it.productName}</span>
              </div>
              {it.amount != null && (
                <div className="text-[10px] text-rk-muted rk-num">
                  {it.kind === "settled" ? `송금 ₩${fmt(it.amount)}` : `월 ₩${fmt(it.amount)}`}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
