"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type DiffRow = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export type QueueCard = {
  id: string;
  productCode: string;
  name: string;
  modelName: string | null;
  category: string | null;
  sourceUrl: string;
  sourceName: string;
  changeType: "new" | "updated" | "unchanged";
  crawledAtLabel: string;
  rentalPrice: number | null;
  cardDiscountPrice: number | null;
  contractPeriod: number | null;
  managementType: string | null;
  description: string | null;
  previewImages: string[];
  previewFeatures: string[];
  previewSpecs: Record<string, string>;
  diff: DiffRow[];
};

const won = (n: number | null) =>
  n == null ? "—" : `₩${Number(n).toLocaleString()}`;

type Filter = "all" | "new" | "updated";

export default function CrawlReviewQueue({ cards }: { cards: QueueCard[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    if (filter === "all") return cards;
    return cards.filter(c => c.changeType === filter);
  }, [cards, filter]);

  const allVisibleSelected = visible.length > 0 && visible.every(c => selected.has(c.id));
  const selectedCount = selected.size;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const c of visible) next.delete(c.id);
      } else {
        for (const c of visible) next.add(c.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const act = async (id: string, action: "approve" | "reject", note?: string) => {
    setError(null);
    setFlash(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/crawl/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "처리 실패");
        return;
      }
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusyId(null);
    }
  };

  const bulkAct = async (ids: string[], action: "approve" | "reject", note?: string | null) => {
    if (ids.length === 0) {
      setError("선택된 항목이 없습니다.");
      return;
    }
    setError(null);
    setFlash(null);
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/crawl/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, note }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "처리 실패");
        return;
      }
      const verb = action === "approve" ? "승인" : "반려";
      const summary =
        j.failed > 0
          ? `${verb} 완료 ${j.succeeded}건 / 실패 ${j.failed}건`
          : `${verb} 완료 ${j.succeeded}건`;
      setFlash(summary);
      setSelected(new Set());
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBulkBusy(false);
    }
  };

  const approveAll = (kind: "new" | "updated" | "all") => {
    const targets = (kind === "all" ? cards : cards.filter(c => c.changeType === kind)).map(c => c.id);
    if (targets.length === 0) return;
    if (!window.confirm(`${kind === "new" ? "신규" : kind === "updated" ? "변경" : "큐의 모든"} ${targets.length}건을 일괄 승인합니다. 계속하시겠습니까?`)) {
      return;
    }
    bulkAct(targets, "approve");
  };

  const approveSelected = () => {
    if (!window.confirm(`선택된 ${selectedCount}건을 승인합니다. 계속하시겠습니까?`)) return;
    bulkAct(Array.from(selected), "approve");
  };

  const rejectSelected = () => {
    const note = window.prompt(`선택된 ${selectedCount}건을 반려합니다. 사유 (선택):`);
    if (note === null) return; // cancel
    bulkAct(Array.from(selected), "reject", note || null);
  };

  if (cards.length === 0) {
    return (
      <div className="bg-white border border-rk-line rounded-lg p-8 text-center">
        <div className="text-[28px] mb-1.5">🎉</div>
        <p className="text-rk-ink text-[13px] font-medium">검토 대기 항목이 없습니다.</p>
        <p className="text-rk-muted text-[13px] mt-1">크롤 실행 시 변경된 항목만 큐에 적재됩니다.</p>
      </div>
    );
  }

  const newCount = cards.filter(c => c.changeType === "new").length;
  const updatedCount = cards.filter(c => c.changeType === "updated").length;

  return (
    <div className="space-y-3">
      {/* 상단 툴바 — 필터 + 일괄 처리 */}
      <div className="bg-white border border-rk-line rounded-lg p-3 flex flex-wrap items-center gap-2 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={
              "px-2.5 py-1 rounded text-[13px] font-medium border " +
              (filter === "all"
                ? "bg-rk-navy text-white border-rk-navy"
                : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")
            }
          >
            전체 {cards.length}
          </button>
          <button
            type="button"
            onClick={() => setFilter("new")}
            className={
              "px-2.5 py-1 rounded text-[13px] font-medium border " +
              (filter === "new"
                ? "bg-rk-success text-white border-rk-success"
                : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")
            }
          >
            🆕 신규 {newCount}
          </button>
          <button
            type="button"
            onClick={() => setFilter("updated")}
            className={
              "px-2.5 py-1 rounded text-[13px] font-medium border " +
              (filter === "updated"
                ? "bg-rk-info text-white border-rk-info"
                : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")
            }
          >
            ✏️ 변경 {updatedCount}
          </button>
        </div>

        <div className="h-5 w-px bg-rk-line-2 mx-1" />

        <label className="flex items-center gap-1.5 text-[14px] text-rk-text cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            className="w-3.5 h-3.5 cursor-pointer"
          />
          현재 보이는 {visible.length}건 전체선택
        </label>

        {selectedCount > 0 && (
          <>
            <span className="text-[13px] text-rk-muted">선택 {selectedCount}건</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[13px] text-rk-muted underline hover:text-rk-ink"
            >
              해제
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={approveSelected}
              className="bg-rk-success hover:opacity-90 disabled:opacity-50 text-white px-3 py-1.5 rounded text-[14px] font-medium border-0 cursor-pointer disabled:cursor-not-allowed"
            >
              {bulkBusy ? "처리 중…" : `✓ 선택 ${selectedCount}건 승인`}
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={rejectSelected}
              className="bg-white hover:bg-rk-soft border border-rk-line text-rk-muted px-3 py-1.5 rounded text-[14px] cursor-pointer disabled:cursor-not-allowed"
            >
              ✕ 선택 반려
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {newCount > 0 && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => approveAll("new")}
              className="bg-rk-tint-green hover:bg-rk-success hover:text-white disabled:opacity-50 text-rk-success px-2.5 py-1.5 rounded text-[13px] font-medium border-0 cursor-pointer disabled:cursor-not-allowed"
            >
              신규 {newCount}건 일괄승인
            </button>
          )}
          {updatedCount > 0 && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => approveAll("updated")}
              className="bg-rk-tint-blue hover:bg-rk-info hover:text-white disabled:opacity-50 text-rk-info px-2.5 py-1.5 rounded text-[13px] font-medium border-0 cursor-pointer disabled:cursor-not-allowed"
            >
              변경 {updatedCount}건 일괄승인
            </button>
          )}
        </div>
      </div>

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

      {visible.map(c => {
        const isSelected = selected.has(c.id);
        return (
          <article
            key={c.id}
            className={
              "bg-white border rounded-lg overflow-hidden transition-colors " +
              (isSelected ? "border-rk-navy ring-1 ring-rk-navy/30" : "border-rk-line")
            }
          >
            <header className="px-4 py-2.5 border-b border-rk-line-2 flex items-center gap-2.5 flex-wrap">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(c.id)}
                className="w-4 h-4 cursor-pointer flex-shrink-0"
              />
              <span
                className={
                  "px-1.5 py-px rounded text-[12px] font-semibold " +
                  (c.changeType === "new"
                    ? "bg-rk-tint-green text-rk-success"
                    : "bg-rk-tint-blue text-rk-info")
                }
              >
                {c.changeType === "new" ? "🆕 신규" : "✏️ 변경"}
              </span>
              <span className="font-semibold text-rk-ink">{c.name}</span>
              <span className="text-rk-muted text-[13px] font-mono">{c.productCode}</span>
              {c.category && (
                <span className="text-rk-muted text-[13px] bg-rk-soft-2 px-1.5 py-px rounded">
                  {c.category}
                </span>
              )}
              <span className="ml-auto text-[13px] text-rk-muted">
                {c.sourceName} · {c.crawledAtLabel}
              </span>
            </header>

            <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
              <div>
                {c.changeType === "new" ? (
                  <div className="space-y-3">
                    {c.previewImages.length > 0 && (
                      <div>
                        <div className="text-[12px] text-rk-muted uppercase tracking-[.04em] mb-1.5">
                          갤러리 ({c.previewImages.length}장)
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {c.previewImages.map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={src}
                              alt={`${c.name} ${i + 1}`}
                              className="w-14 h-14 rounded border border-rk-line-2 object-cover bg-rk-soft-2"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <dl className="text-[14px] grid grid-cols-[110px_1fr] gap-y-1.5 gap-x-3">
                      <dt className="text-rk-muted">월 렌탈료</dt>
                      <dd className="text-rk-ink">{won(c.rentalPrice)}</dd>
                      <dt className="text-rk-muted">카드할인가</dt>
                      <dd className="text-rk-ink">{won(c.cardDiscountPrice)}</dd>
                      <dt className="text-rk-muted">약정기간</dt>
                      <dd className="text-rk-ink">{c.contractPeriod ?? "—"}개월</dd>
                      <dt className="text-rk-muted">관리방식</dt>
                      <dd className="text-rk-ink">{c.managementType ?? "—"}</dd>
                      <dt className="text-rk-muted">소스 URL</dt>
                      <dd>
                        <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-rk-info underline break-all">
                          {c.sourceUrl}
                        </a>
                      </dd>
                      {c.description && (
                        <>
                          <dt className="text-rk-muted">설명</dt>
                          <dd className="text-rk-text leading-[1.55] whitespace-pre-line">{c.description}</dd>
                        </>
                      )}
                    </dl>
                    {c.previewFeatures.length > 0 && (
                      <div>
                        <div className="text-[12px] text-rk-muted uppercase tracking-[.04em] mb-1.5">
                          핵심 기능 ({c.previewFeatures.length})
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {c.previewFeatures.map((f, i) => (
                            <span key={i} className="text-[13px] bg-rk-tint-green text-rk-success px-1.5 py-0.5 rounded">
                              ✓ {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {Object.keys(c.previewSpecs).length > 0 && (
                      <div>
                        <div className="text-[12px] text-rk-muted uppercase tracking-[.04em] mb-1.5">
                          스펙 ({Object.keys(c.previewSpecs).length}개)
                        </div>
                        <dl className="text-[13px] grid grid-cols-[110px_1fr] gap-y-1 gap-x-3 bg-rk-soft-2 rounded p-2">
                          {Object.entries(c.previewSpecs).slice(0, 8).map(([k, v]) => (
                            <SpecMini key={k} label={k} value={v} />
                          ))}
                          {Object.keys(c.previewSpecs).length > 8 && (
                            <dd className="col-span-2 text-rk-muted text-[12px]">
                              + {Object.keys(c.previewSpecs).length - 8}개 더
                            </dd>
                          )}
                        </dl>
                      </div>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-[14px]">
                    <thead className="text-rk-muted">
                      <tr>
                        <th className="text-left pr-2 pb-1 font-medium w-[110px]">필드</th>
                        <th className="text-left pr-2 pb-1 font-medium">기존</th>
                        <th className="text-left pl-2 pb-1 font-medium">크롤 결과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.diff.map(d => (
                        <tr key={d.field} className="border-t border-rk-line-2 align-top">
                          <td className="pr-2 py-1.5 text-rk-muted">{d.label}</td>
                          <td className="pr-2 py-1.5 text-rk-orange-deep line-through opacity-80 break-words">
                            {d.before || "—"}
                          </td>
                          <td className="pl-2 py-1.5 text-rk-success font-medium break-words">
                            {d.after || "—"}
                          </td>
                        </tr>
                      ))}
                      {c.diff.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-rk-muted text-[13px]">변경된 필드 없음</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex md:flex-col gap-2 md:w-[140px]">
                <button
                  type="button"
                  disabled={busyId === c.id || pending || bulkBusy}
                  onClick={() => act(c.id, "approve")}
                  className="flex-1 bg-rk-success hover:opacity-90 disabled:opacity-50 text-white px-3 py-2 rounded text-[14px] font-medium border-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {busyId === c.id ? "처리 중…" : "✓ 승인"}
                </button>
                <button
                  type="button"
                  disabled={busyId === c.id || pending || bulkBusy}
                  onClick={() => {
                    const note = window.prompt("반려 사유 (선택)") ?? undefined;
                    act(c.id, "reject", note ?? undefined);
                  }}
                  className="flex-1 bg-white hover:bg-rk-soft border border-rk-line text-rk-muted px-3 py-2 rounded text-[14px] cursor-pointer disabled:cursor-not-allowed"
                >
                  ✕ 반려
                </button>
              </div>
            </div>
          </article>
        );
      })}

      {visible.length === 0 && (
        <div className="bg-white border border-rk-line rounded-lg p-6 text-center text-rk-muted text-[14px]">
          현재 필터에 해당하는 항목이 없습니다.
        </div>
      )}
    </div>
  );
}

function SpecMini({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-rk-muted m-0">{label}</dt>
      <dd className="text-rk-ink m-0 break-words">{value}</dd>
    </>
  );
}
