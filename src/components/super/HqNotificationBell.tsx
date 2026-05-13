"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Item = {
  kind: string;
  severity: "info" | "warn" | "critical";
  label: string;
  count: number;
  detail: string;
  href: string;
};

type Snapshot = {
  totalCount: number;
  items: Item[];
  recentCrawl: {
    runId: string;
    sourceName: string;
    finishedAtLabel: string;
    status: string;
    newCount: number;
    updatedCount: number;
    unchangedCount: number;
    errorMessage: string | null;
  } | null;
};

const SEV_PILL: Record<string, string> = {
  critical: "bg-rk-tint-red text-rk-sale border-rk-tint-red",
  warn:     "bg-rk-tint-orange text-rk-orange-deep border-rk-tint-orange",
  info:     "bg-rk-tint-blue text-rk-info border-rk-tint-blue",
};

export default function HqNotificationBell({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // 60초마다 재조회
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch("/api/notifications/hq", { cache: "no-store" });
        if (res.ok) setSnapshot(await res.json());
      } catch { /* noop */ }
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const total = snapshot.totalCount;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="bg-white border border-rk-line px-2.5 py-1.5 rounded text-[14px] cursor-pointer relative hover:bg-rk-soft-2"
      >
        🔔 알림
        {total > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rk-sale text-white text-[12px] font-bold px-1.5 py-px rounded-full min-w-[18px] text-center rk-num">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[360px] bg-white border border-rk-line rounded-lg shadow-[0_8px_24px_rgba(20,25,40,.08)] z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-rk-line-2 flex items-center">
            <b className="text-[13px] text-rk-ink">알림</b>
            <span className="ml-auto text-[13px] text-rk-muted">총 {total}건</span>
          </div>

          {snapshot.items.length === 0 ? (
            <div className="p-4 text-center text-[14px] text-rk-muted">
              <div className="text-[24px] mb-1">✅</div>
              모든 운영 항목이 처리되었습니다.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {snapshot.items.map(it => (
                <Link
                  key={it.kind}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 border-b border-rk-line-2 hover:bg-rk-soft-2 no-underline transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={"text-[12px] px-1.5 py-px rounded font-medium border " + SEV_PILL[it.severity]}>
                      {it.label}
                    </span>
                    <b className="text-rk-ink text-[13px] rk-num">{it.count}</b>
                    <span className="ml-auto text-[12px] text-rk-info">바로 가기 →</span>
                  </div>
                  <div className="text-[13px] text-rk-muted leading-[1.4]">{it.detail}</div>
                </Link>
              ))}
            </div>
          )}

          {/* 최근 크롤 결과 */}
          {snapshot.recentCrawl && (
            <div className="px-4 py-2.5 bg-rk-soft-2 border-t border-rk-line-2">
              <div className="text-[12px] text-rk-faint uppercase tracking-[.04em] mb-1">최근 크롤</div>
              <div className="flex items-center gap-2 text-[13px] flex-wrap">
                <b className="text-rk-ink">{snapshot.recentCrawl.sourceName}</b>
                <span className="text-rk-muted">{snapshot.recentCrawl.finishedAtLabel}</span>
                <span
                  className={
                    "text-[9px] px-1.5 py-px rounded font-medium " +
                    (snapshot.recentCrawl.status === "success"
                      ? "bg-rk-tint-green text-rk-success"
                      : "bg-rk-tint-red text-rk-sale")
                  }
                >
                  {snapshot.recentCrawl.status}
                </span>
              </div>
              {snapshot.recentCrawl.status === "success" && (
                <div className="text-[12px] text-rk-muted mt-1">
                  신규 <b className="text-rk-success">{snapshot.recentCrawl.newCount}</b> ·
                  변경 <b className="text-rk-info">{snapshot.recentCrawl.updatedCount}</b> ·
                  변경없음 <b>{snapshot.recentCrawl.unchangedCount}</b>
                </div>
              )}
              {snapshot.recentCrawl.errorMessage && (
                <div className="text-[12px] text-rk-sale mt-1">⚠ {snapshot.recentCrawl.errorMessage}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
