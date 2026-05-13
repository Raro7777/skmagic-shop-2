"use client";

import { useEffect, useState, useCallback } from "react";

type Broadcast = {
  id: string;
  tone: "default" | "urgent" | "event" | string;
  badge: string;
  title: string;
  body: string;
  ageMinutes: number;
};

const BC_TONE: Record<string, string> = {
  default: "border-rk-navy bg-white",
  urgent:  "border-rk-sale bg-[#fffafa]",
  event:   "border-rk-orange bg-rk-tint-orange",
};

const STORAGE_KEY = "rk_dismissed_broadcasts_v1";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export default function HqBroadcastBanner() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/broadcasts?limit=10", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.broadcasts);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setDismissed(loadDismissed());
    fetchData();
  }, [fetchData]);

  const visible = items.filter(b => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  const featured = visible[0];
  const hasMore = visible.length > 1;

  const dismissOne = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(next);
  };
  const dismissAll = () => {
    const next = new Set(dismissed);
    visible.forEach(b => next.add(b.id));
    setDismissed(next);
    saveDismissed(next);
  };

  return (
    <section className="mb-3">
      <div className={"border border-l-4 rounded-md px-3 py-2.5 " + BC_TONE[featured.tone]}>
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          <b className={featured.tone === "urgent" ? "text-rk-sale text-[13px]" : featured.tone === "event" ? "text-rk-orange-deep text-[13px]" : "text-rk-navy text-[13px]"}>
            {featured.badge}
          </b>
          <small className="text-[12px] text-rk-muted">📢 본사 공지</small>
          <small className="text-[12px] text-rk-muted">{formatAge(featured.ageMinutes)}</small>
          <button
            type="button"
            onClick={() => dismissOne(featured.id)}
            className="ml-auto text-rk-faint hover:text-rk-sale bg-transparent border-0 cursor-pointer text-[13px]"
            title="이 공지 닫기"
          >
            ✕
          </button>
        </div>
        <h6 className="text-[13px] font-semibold text-rk-ink mb-1 m-0">{featured.title}</h6>
        <p className="text-[13px] text-rk-text m-0 leading-[1.6] whitespace-pre-line">{featured.body}</p>
      </div>

      {hasMore && (
        <>
          {expanded && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              {visible.slice(1).map(b => (
                <div key={b.id} className={"border border-l-4 rounded-md px-3 py-2 " + BC_TONE[b.tone]}>
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <b className={b.tone === "urgent" ? "text-rk-sale text-[12px]" : b.tone === "event" ? "text-rk-orange-deep text-[12px]" : "text-rk-navy text-[12px]"}>
                      {b.badge}
                    </b>
                    <small className="text-[12px] text-rk-muted">{formatAge(b.ageMinutes)}</small>
                    <button
                      type="button"
                      onClick={() => dismissOne(b.id)}
                      className="ml-auto text-rk-faint hover:text-rk-sale bg-transparent border-0 cursor-pointer text-[13px]"
                    >
                      ✕
                    </button>
                  </div>
                  <h6 className="text-[14px] font-medium text-rk-ink m-0">{b.title}</h6>
                  <p className="text-[13px] text-rk-muted m-0 mt-0.5 leading-[1.5] line-clamp-2">{b.body}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-1.5 text-[13px]">
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="text-rk-info bg-transparent border-0 cursor-pointer"
            >
              {expanded ? "▲ 접기" : `▼ 다른 공지 ${visible.length - 1}건 더 보기`}
            </button>
            {expanded && (
              <button
                type="button"
                onClick={dismissAll}
                className="ml-auto text-rk-faint bg-transparent border-0 cursor-pointer"
              >
                모두 읽음 처리
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function formatAge(minutes: number): string {
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}
