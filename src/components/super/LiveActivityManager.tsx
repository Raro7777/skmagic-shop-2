"use client";

import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  customerName: string;
  productName: string;
  region: string | null;
  status: string;
  minutesAgo: number;
  priority: number;
  isActive: boolean;
};
type Draft = Omit<Item, "id">;

const STATUSES = ["접수완료", "상담대기", "설치완료"] as const;

const emptyDraft = (): Draft => ({
  customerName: "김**",
  productName: "투워터 정수기",
  region: "강남구",
  status: "접수완료",
  minutesAgo: 5,
  priority: 0,
  isActive: true,
});

export default function LiveActivityManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/live-activities", { cache: "no-store" });
      const j = await r.json();
      if (r.ok) setItems(j.items);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing("new"); setDraft(emptyDraft()); setFlash(null); };
  const startEdit = (it: Item) => {
    setEditing(it.id);
    setDraft({ customerName: it.customerName, productName: it.productName, region: it.region, status: it.status, minutesAgo: it.minutesAgo, priority: it.priority, isActive: it.isActive });
    setFlash(null);
  };
  const cancel = () => { setEditing(null); setDraft(null); };

  const save = async () => {
    if (!draft || !editing) return;
    setSaving(true);
    try {
      const r = editing === "new"
        ? await fetch("/api/admin/live-activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) })
        : await fetch(`/api/admin/live-activities/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const j = await r.json();
      if (!r.ok) { setFlash(j.error ?? "저장 실패"); return; }
      setFlash(editing === "new" ? "신규 등록 완료" : "수정 완료");
      setEditing(null); setDraft(null);
      await load();
    } finally { setSaving(false); }
  };

  const toggleActive = async (it: Item) => {
    await fetch(`/api/admin/live-activities/${it.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !it.isActive }) });
    await load();
  };

  const remove = async (it: Item) => {
    if (!window.confirm(`"${it.customerName} · ${it.productName}" 삭제할까요?`)) return;
    await fetch(`/api/admin/live-activities/${it.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-[14px] font-semibold">📡 등록된 활동 ({items.length}건 · 활성 {items.filter(i => i.isActive).length}건)</h3>
        <button type="button" onClick={startNew} disabled={editing !== null} className="bg-rk-orange hover:bg-rk-orange-deep disabled:opacity-50 text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer">+ 신규 등록</button>
      </div>

      {flash && <div className="mb-3 bg-rk-tint-green border border-[#C8E6C9] text-rk-success text-[13px] px-3 py-1.5 rounded">{flash}</div>}

      {editing && draft && (
        <div className="mb-4 bg-rk-soft border border-rk-line rounded p-3">
          <div className="grid grid-cols-2 gap-2 text-[13px] mb-2">
            <label className="flex flex-col gap-1"><span className="text-rk-muted text-[12px]">고객명 (마스킹)</span>
              <input value={draft.customerName} onChange={e => setDraft({ ...draft, customerName: e.target.value })} placeholder="김**" className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </label>
            <label className="flex flex-col gap-1"><span className="text-rk-muted text-[12px]">상품명</span>
              <input value={draft.productName} onChange={e => setDraft({ ...draft, productName: e.target.value })} placeholder="투워터 정수기" className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </label>
            <label className="flex flex-col gap-1"><span className="text-rk-muted text-[12px]">지역 (선택)</span>
              <input value={draft.region ?? ""} onChange={e => setDraft({ ...draft, region: e.target.value || null })} placeholder="강남구" className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </label>
            <label className="flex flex-col gap-1"><span className="text-rk-muted text-[12px]">상태</span>
              <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px] bg-white">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1"><span className="text-rk-muted text-[12px]">N 분 전</span>
              <input type="number" value={draft.minutesAgo} onChange={e => setDraft({ ...draft, minutesAgo: Math.max(0, parseInt(e.target.value) || 0) })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </label>
            <label className="flex flex-col gap-1"><span className="text-rk-muted text-[12px]">우선순위</span>
              <input type="number" value={draft.priority} onChange={e => setDraft({ ...draft, priority: Math.max(0, parseInt(e.target.value) || 0) })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </label>
            <label className="col-span-2 flex items-center gap-2 mt-1 cursor-pointer">
              <input type="checkbox" checked={draft.isActive} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} className="w-4 h-4 accent-rk-orange" />
              <span className="text-[13px]">활성 (체크 시 사이트 노출)</span>
            </label>
          </div>
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={cancel} disabled={saving} className="bg-white border border-rk-line text-rk-text px-3 py-1 rounded text-[13px] cursor-pointer">취소</button>
            <button type="button" onClick={save} disabled={saving} className="bg-rk-navy hover:bg-rk-navy-deep disabled:opacity-50 text-white border-0 px-3 py-1 rounded text-[13px] font-medium cursor-pointer">
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-rk-muted">로딩 중…</div>
      ) : items.length === 0 ? (
        <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-6 text-center text-[14px] text-rk-muted">등록된 활동이 없습니다.</div>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map(it => (
            <div key={it.id} className={"grid grid-cols-[60px_120px_180px_80px_70px_60px_50px_auto_auto] gap-2 items-center bg-rk-soft-2 border border-rk-line-2 px-3 py-2 rounded text-[13px] " + (it.isActive ? "" : "opacity-50")}>
              <span className="text-[12px] font-mono text-rk-muted">⊙ {it.priority}</span>
              <span className="font-medium">{it.customerName}</span>
              <span className="truncate" title={it.productName}>{it.productName}</span>
              <span className="text-rk-muted text-[12px]">{it.region ?? "—"}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-rk-tint-blue text-rk-info text-center">{it.status}</span>
              <span className="text-[11px] text-rk-muted text-center">{it.minutesAgo}분 전</span>
              <button type="button" onClick={() => toggleActive(it)} className={"text-[12px] cursor-pointer " + (it.isActive ? "text-rk-success" : "text-rk-muted")}>{it.isActive ? "활성" : "비활성"}</button>
              <button type="button" onClick={() => startEdit(it)} disabled={editing !== null} className="text-rk-info text-[12px] hover:underline disabled:opacity-30 cursor-pointer">편집</button>
              <button type="button" onClick={() => remove(it)} className="text-rk-sale text-[12px] hover:underline cursor-pointer">삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
