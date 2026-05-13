"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SourceRow = {
  id: string;
  slug: string;
  name: string;
  baseUrl: string;
  status: string;
  intervalMin: number;
  lastCrawledAt: string | null;
  pendingCount: number;
};

type RunRow = {
  id: string;
  sourceName: string;
  startedLabel: string;
  finishedLabel: string | null;
  status: string;
  itemCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorMessage: string | null;
};

export default function CrawlSourcesPanel({
  sources,
  recentRuns,
}: {
  sources: SourceRow[];
  recentRuns: RunRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [runningSlug, setRunningSlug] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trigger = async (slug: string) => {
    setError(null);
    setFlash(null);
    setRunningSlug(slug);
    try {
      const res = await fetch("/api/admin/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceSlug: slug }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "크롤 실패");
      } else {
        setFlash(
          `${slug}: ${j.itemCount}건 수집 (신규 ${j.newCount} / 업데이트 ${j.updatedCount} / 변경없음 ${j.unchangedCount})`,
        );
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setRunningSlug(null);
    }
  };

  return (
    <div className="space-y-5">
      {flash && (
        <div className="bg-rk-tint-green text-rk-success px-3 py-2 rounded text-[14px]">
          ✅ {flash}
        </div>
      )}
      {error && (
        <div className="bg-rk-tint-orange text-rk-orange-deep px-3 py-2 rounded text-[14px]">
          ⚠ {error}
        </div>
      )}

      <section className="bg-white border border-rk-line rounded-lg overflow-hidden">
        <header className="px-4 py-2.5 border-b border-rk-line-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-[-.01em]">등록된 크롤 소스</h2>
          <small className="text-[13px] text-rk-muted">활성 소스만 즉시 실행 가능</small>
        </header>
        <table className="w-full text-[14px]">
          <thead className="bg-rk-soft-2 text-rk-muted">
            <tr>
              <th className="text-left px-3 py-2 font-medium">이름</th>
              <th className="text-left px-3 py-2 font-medium">slug</th>
              <th className="text-left px-3 py-2 font-medium">URL</th>
              <th className="text-left px-3 py-2 font-medium">상태</th>
              <th className="text-left px-3 py-2 font-medium">주기(분)</th>
              <th className="text-left px-3 py-2 font-medium">마지막 실행</th>
              <th className="text-left px-3 py-2 font-medium">대기 큐</th>
              <th className="text-right px-3 py-2 font-medium">실행</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.id} className="border-t border-rk-line-2">
                <td className="px-3 py-2 font-medium text-rk-ink">{s.name}</td>
                <td className="px-3 py-2 text-rk-muted font-mono text-[13px]">{s.slug}</td>
                <td className="px-3 py-2 text-rk-muted text-[13px] truncate max-w-[260px]">{s.baseUrl}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      "px-1.5 py-px rounded text-[12px] font-medium " +
                      (s.status === "active"
                        ? "bg-rk-tint-green text-rk-success"
                        : "bg-rk-soft text-rk-muted")
                    }
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-rk-muted">{s.intervalMin}</td>
                <td className="px-3 py-2 text-rk-muted">{s.lastCrawledAt ?? "—"}</td>
                <td className="px-3 py-2">
                  {s.pendingCount > 0 ? (
                    <span className="bg-rk-tint-orange text-rk-orange-deep px-1.5 py-px rounded text-[12px] font-semibold">
                      {s.pendingCount}건
                    </span>
                  ) : (
                    <span className="text-rk-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={s.status !== "active" || runningSlug === s.slug || pending}
                    onClick={() => trigger(s.slug)}
                    className="bg-rk-orange hover:bg-rk-orange-deep disabled:bg-rk-soft disabled:text-rk-muted text-white px-3 py-1 rounded text-[13px] border-0 font-medium cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    {runningSlug === s.slug ? "수집 중…" : "크롤 실행"}
                  </button>
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-rk-muted">
                  등록된 크롤 소스가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-rk-line rounded-lg overflow-hidden">
        <header className="px-4 py-2.5 border-b border-rk-line-2">
          <h2 className="text-[13px] font-semibold tracking-[-.01em]">최근 실행 이력</h2>
        </header>
        <table className="w-full text-[14px]">
          <thead className="bg-rk-soft-2 text-rk-muted">
            <tr>
              <th className="text-left px-3 py-2 font-medium">소스</th>
              <th className="text-left px-3 py-2 font-medium">시작</th>
              <th className="text-left px-3 py-2 font-medium">종료</th>
              <th className="text-left px-3 py-2 font-medium">상태</th>
              <th className="text-left px-3 py-2 font-medium">총 항목</th>
              <th className="text-left px-3 py-2 font-medium">신규</th>
              <th className="text-left px-3 py-2 font-medium">업데이트</th>
              <th className="text-left px-3 py-2 font-medium">변경 없음</th>
            </tr>
          </thead>
          <tbody>
            {recentRuns.map(r => (
              <tr key={r.id} className="border-t border-rk-line-2">
                <td className="px-3 py-2 text-rk-ink">{r.sourceName}</td>
                <td className="px-3 py-2 text-rk-muted">{r.startedLabel}</td>
                <td className="px-3 py-2 text-rk-muted">{r.finishedLabel ?? "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      "px-1.5 py-px rounded text-[12px] font-medium " +
                      (r.status === "success"
                        ? "bg-rk-tint-green text-rk-success"
                        : r.status === "failed"
                          ? "bg-rk-tint-orange text-rk-orange-deep"
                          : "bg-rk-tint-blue text-rk-info")
                    }
                  >
                    {r.status}
                  </span>
                  {r.errorMessage && (
                    <div className="text-[12px] text-rk-orange-deep mt-0.5 max-w-[200px]">{r.errorMessage}</div>
                  )}
                </td>
                <td className="px-3 py-2">{r.itemCount}</td>
                <td className="px-3 py-2 text-rk-success">{r.newCount}</td>
                <td className="px-3 py-2 text-rk-info">{r.updatedCount}</td>
                <td className="px-3 py-2 text-rk-muted">{r.unchangedCount}</td>
              </tr>
            ))}
            {recentRuns.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-rk-muted">
                  실행 이력이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
