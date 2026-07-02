"use client";

import { useCallback, useEffect, useState } from "react";

type Benefit = {
  id: string;
  title: string;
  description: string;
  iconEmoji: string;
  linkHref: string;
  order: number;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
};

const ICON_OPTIONS = ["🎁", "🌸", "❄️", "🌞", "🎉", "💰", "🚚", "⚡", "🏆", "💎", "🎊", "🌈"];
const isoToInput = (iso: string | null): string => (iso ? iso.slice(0, 10) : "");
const inputToIso = (v: string): string | null => (v ? new Date(v + "T00:00:00.000Z").toISOString() : null);

export default function BenefitsManager() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [maxBenefits, setMaxBenefits] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/franchise/benefits");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBenefits(data.benefits ?? []);
      setMaxBenefits(data.maxBenefits ?? 3);
    } catch {
      setError("불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (benefits.length >= maxBenefits) return;
    setBusy("__new__");
    try {
      const res = await fetch("/api/franchise/benefits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "새 혜택", description: "", iconEmoji: "🎁", enabled: true, order: benefits.length }),
      });
      if (!res.ok) { setError((await res.json())?.error ?? "추가 실패"); return; }
      const created = (await res.json()) as Benefit;
      setBenefits(prev => [...prev, created]);
    } catch {
      setError("추가 실패");
    } finally { setBusy(null); }
  };

  const patch = async (id: string, patch: Partial<Benefit>) => {
    setBusy(id);
    try {
      const res = await fetch("/api/franchise/benefits", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) { setError("수정 실패"); return; }
      const updated = (await res.json()) as Benefit;
      setBenefits(prev => prev.map(b => b.id === id ? updated : b));
    } catch { setError("수정 실패"); } finally { setBusy(null); }
  };

  const remove = async (id: string) => {
    if (!confirm("이 혜택을 삭제할까요?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/franchise/benefits?id=${id}`, { method: "DELETE" });
      if (!res.ok) { setError("삭제 실패"); return; }
      setBenefits(prev => prev.filter(b => b.id !== id));
    } catch { setError("삭제 실패"); } finally { setBusy(null); }
  };

  if (loading) return <div className="text-center text-[13px] text-rk-muted py-8">로딩 중…</div>;

  return (
    <div className="space-y-3">
      {error && <div className="bg-rk-tint-red text-rk-sale px-3 py-2 rounded text-[13px]">⚠ {error}</div>}

      {/* 추가 버튼 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={benefits.length >= maxBenefits || busy === "__new__"}
          className="bg-rk-orange hover:bg-rk-orange-deep disabled:opacity-50 disabled:cursor-not-allowed text-white border-0 px-3.5 py-1.5 rounded text-[13px] font-medium cursor-pointer"
        >
          {busy === "__new__" ? "추가 중…" : "+ 혜택 추가"}
        </button>
        <small className="text-[12px] text-rk-muted">{benefits.length} / {maxBenefits} 슬롯 사용 중 (최대 {maxBenefits}장)</small>
      </div>

      {/* 카드 목록 */}
      {benefits.length === 0 ? (
        <div className="text-center text-[13px] text-rk-muted py-8 border border-dashed border-rk-line-2 rounded">
          등록된 혜택이 없습니다. 위 "+ 혜택 추가" 를 눌러 시작하세요.
        </div>
      ) : (
        <div className="space-y-2">
          {benefits.map(b => {
            const isBusy = busy === b.id;
            const isActive = isBenefitActive(b);
            return (
              <div key={b.id} className={"border rounded p-3 space-y-2 " + (isActive ? "border-rk-orange/40 bg-rk-tint-orange/20" : "border-rk-line-2 bg-white")}>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 이모지 선택 */}
                  <select
                    value={b.iconEmoji}
                    onChange={e => patch(b.id, { iconEmoji: e.target.value })}
                    disabled={isBusy}
                    className="w-[68px] text-[20px] px-1 py-1 border border-rk-line rounded text-center bg-white"
                  >
                    {ICON_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <input
                    type="text"
                    defaultValue={b.title}
                    placeholder="혜택 제목"
                    maxLength={30}
                    disabled={isBusy}
                    onBlur={e => { if (e.target.value !== b.title) patch(b.id, { title: e.target.value }); }}
                    className="flex-1 min-w-[150px] px-2 py-1.5 border border-rk-line rounded text-[14px] font-semibold bg-white"
                  />
                  <label className="flex items-center gap-1 text-[13px] cursor-pointer">
                    <input type="checkbox" checked={b.enabled} disabled={isBusy}
                      onChange={e => patch(b.id, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-rk-orange cursor-pointer" />
                    <span className={b.enabled ? "text-rk-orange-deep font-semibold" : "text-rk-muted"}>{b.enabled ? "ON" : "OFF"}</span>
                  </label>
                  <span className={"text-[11px] px-1.5 py-0.5 rounded font-medium " + (isActive ? "bg-rk-success text-white" : "bg-rk-muted/15 text-rk-muted")}>
                    {isActive ? "✓ 노출 중" : "미노출"}
                  </span>
                  <button type="button" disabled={isBusy} onClick={() => remove(b.id)} className="text-rk-sale hover:underline text-[12px] cursor-pointer">삭제</button>
                </div>

                <input
                  type="text"
                  defaultValue={b.description}
                  placeholder="설명 (예: 신규 가입 시 첫 3개월 무료)"
                  maxLength={60}
                  disabled={isBusy}
                  onBlur={e => { if (e.target.value !== b.description) patch(b.id, { description: e.target.value }); }}
                  className="w-full px-2 py-1.5 border border-rk-line rounded text-[13px] bg-white"
                />

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    defaultValue={b.linkHref}
                    placeholder="링크 (선택) — 예: /p/… 또는 https://…"
                    disabled={isBusy}
                    onBlur={e => { if (e.target.value !== b.linkHref) patch(b.id, { linkHref: e.target.value }); }}
                    className="w-full px-2 py-1.5 border border-rk-line rounded text-[12px] bg-white text-rk-muted font-mono"
                  />
                  <div className="flex items-center gap-1 text-[12px] text-rk-muted">
                    <input type="date" defaultValue={isoToInput(b.startsAt)} disabled={isBusy}
                      onChange={e => patch(b.id, { startsAt: inputToIso(e.target.value) })}
                      className="px-1.5 py-1.5 border border-rk-line rounded text-[13px] bg-white" />
                    <span>~</span>
                    <input type="date" defaultValue={isoToInput(b.endsAt)} disabled={isBusy}
                      onChange={e => patch(b.id, { endsAt: inputToIso(e.target.value) })}
                      className="px-1.5 py-1.5 border border-rk-line rounded text-[13px] bg-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        💡 <b>노출 조건</b> — ON + 제목 입력 + 현재 날짜 ∈ [시작일, 종료일] (날짜 비우면 무제한).<br />
        컨슈머 메인 페이지의 <b>매니저 추천 상품 위</b>에 3장 가로 그리드로 노출. 링크 비워두면 클릭 시 상담폼 열림.
      </div>
    </div>
  );
}

function isBenefitActive(b: Benefit): boolean {
  if (!b.enabled) return false;
  if (!b.title.trim()) return false;
  const now = Date.now();
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return false;
  if (b.endsAt && new Date(b.endsAt).getTime() + 24 * 60 * 60 * 1000 < now) return false;
  return true;
}
