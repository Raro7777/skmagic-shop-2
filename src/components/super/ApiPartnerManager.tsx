"use client";

import { useCallback, useEffect, useState } from "react";

type ApiPartner = {
  id: string;
  slug: string;
  name: string;
  apiKeyMasked: string;
  status: "active" | "disabled";
  allowedCategories: string[];
  contactEmail: string | null;
  webhookUrl: string | null;
  totalLeads: number;
  totalProductFetches: number;
  lastUsedAt: string | null;
  createdAt: string;
};

const ALL_CATEGORIES = ["water", "air", "bidet", "mattress", "massage", "dryer", "kitchen"];
const CATEGORY_LABEL: Record<string, string> = {
  water: "정수기", air: "공청", bidet: "비데", mattress: "매트리스", massage: "안마", dryer: "건조기", kitchen: "주방",
};

export default function ApiPartnerManager() {
  const [partners, setPartners] = useState<ApiPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newCats, setNewCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [keyReveal, setKeyReveal] = useState<{ slug: string; apiKey: string } | null>(null);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/api-partners", { cache: "no-store" });
      if (!res.ok) { setError("로드 실패"); return; }
      const j = await res.json();
      setPartners(j.partners);
      setError(null);
    } catch { setError("네트워크 오류"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newSlug.trim() || !newName.trim()) { setFlash({ tone: "err", text: "slug + 이름 필요" }); return; }
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/api-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: newSlug.trim(), name: newName.trim(), allowedCategories: newCats }),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "등록 실패" }); return; }
      setKeyReveal({ slug: j.slug, apiKey: j.apiKey });
      setNewSlug(""); setNewName(""); setNewCats([]);
      setAdding(false);
      await load();
    } catch { setFlash({ tone: "err", text: "네트워크 오류" }); }
    finally { setBusy(false); }
  };

  const action = async (p: ApiPartner, payload: Record<string, unknown>, label: string) => {
    setFlash(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/api-partners/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? `${label} 실패` }); return; }
      if (j.apiKey) setKeyReveal({ slug: p.slug, apiKey: j.apiKey });
      else setFlash({ tone: "ok", text: `${label} 완료` });
      await load();
    } catch { setFlash({ tone: "err", text: "네트워크 오류" }); }
    finally { setBusy(false); }
  };

  const remove = async (p: ApiPartner) => {
    if (!window.confirm(`API 채널 "${p.name}"을 삭제합니다. 이 키로 들어오는 모든 요청이 거부됩니다.\n계속하시겠습니까?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/api-partners/${p.id}`, { method: "DELETE" });
      if (!res.ok) { setFlash({ tone: "err", text: "삭제 실패" }); return; }
      setFlash({ tone: "ok", text: "삭제됨" });
      await load();
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="bg-white border border-rk-line rounded-lg p-4 text-center text-[14px] text-rk-muted py-6">로딩 중…</div>;
  }
  if (error) {
    return <div className="bg-white border border-rk-line rounded-lg p-4"><div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded">⚠ {error}</div></div>;
  }

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      {/* API key reveal modal */}
      {keyReveal && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50" onClick={() => setKeyReveal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg p-5 max-w-[520px] w-full mx-4 shadow-xl">
            <h3 className="text-[15px] font-semibold text-rk-ink mb-2">🔑 API 키 발급</h3>
            <p className="text-[14px] text-rk-muted mb-3">
              <b className="font-mono">{keyReveal.slug}</b> 외부 채널의 API 키입니다.
              외부 사이트에 즉시 등록하세요. <b className="text-rk-sale">창을 닫으면 다시 조회할 수 없습니다.</b>
            </p>
            <div className="bg-rk-soft-2 border border-rk-line rounded p-3 font-mono text-[14px] text-rk-ink break-all">
              {keyReveal.apiKey}
            </div>
            <div className="mt-3 bg-rk-tint-blue text-rk-info text-[13px] p-2.5 rounded leading-[1.55]">
              <b>사용법</b>:<br />
              <code className="font-mono">curl -H &quot;Authorization: Bearer {keyReveal.apiKey.slice(0, 16)}…&quot; https://rentking-next.vercel.app/api/external/products</code>
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button onClick={() => navigator.clipboard?.writeText(keyReveal.apiKey)} className="bg-rk-soft hover:bg-rk-line text-rk-text px-3 py-1.5 rounded text-[14px] cursor-pointer border-0">복사</button>
              <button onClick={() => setKeyReveal(null)} className="bg-rk-navy hover:bg-rk-navy-deep text-white px-3 py-1.5 rounded text-[14px] cursor-pointer border-0">닫기</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">🔌 외부 API 채널</h3>
        <span className="text-[13px] text-rk-muted">{partners.length}개 채널 등록 — 외부 사이트가 우리 상품/가격/정책을 가져가서 자기 사이트에 노출</span>
        <button
          type="button"
          onClick={() => setAdding(v => !v)}
          className="ml-auto bg-rk-orange hover:bg-rk-orange-deep text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer"
        >
          {adding ? "취소" : "+ 새 채널"}
        </button>
      </div>

      {flash && (
        <div className={"px-3 py-2 rounded text-[13px] mb-2 " + (flash.tone === "ok" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
          {flash.tone === "ok" ? "✓ " : "⚠ "}{flash.text}
        </div>
      )}

      {adding && (
        <div className="bg-rk-soft-2 border border-rk-navy rounded-md p-3 mb-3">
          <div className="grid grid-cols-2 gap-2 text-[14px]">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] text-rk-muted">slug (영문 소문자/하이픈)</span>
              <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="coupang-rental" className="border border-rk-line rounded px-2 py-1 font-mono" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] text-rk-muted">채널 이름</span>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="쿠팡 렌탈 카테고리" className="border border-rk-line rounded px-2 py-1" />
            </label>
          </div>
          <div className="mt-2">
            <div className="text-[13px] text-rk-muted mb-1">허용 카테고리 (선택 안 하면 전체 허용)</div>
            <div className="flex gap-1 flex-wrap">
              {ALL_CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewCats(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c])}
                  className={"px-2 py-1 rounded text-[13px] border " + (newCats.includes(c) ? "bg-rk-navy text-white border-rk-navy" : "bg-white text-rk-muted border-rk-line")}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button type="button" disabled={busy} onClick={create} className="bg-rk-navy hover:bg-rk-navy-deep text-white px-3 py-1.5 rounded text-[14px] cursor-pointer disabled:opacity-50">
              {busy ? "등록 중…" : "API 키 발급"}
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-[14px]">
        <thead className="bg-rk-soft-2 text-rk-muted">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">채널 / slug</th>
            <th className="text-left px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">API 키</th>
            <th className="text-left px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">허용 카테고리</th>
            <th className="text-left px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">사용 통계</th>
            <th className="text-left px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">상태</th>
            <th className="text-right px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">작업</th>
          </tr>
        </thead>
        <tbody>
          {partners.map(p => (
            <tr key={p.id} className="border-t border-rk-line-2">
              <td className="px-3 py-2.5">
                <b className="text-rk-ink text-[13px] block">{p.name}</b>
                <small className="text-rk-muted font-mono text-[12px]">{p.slug}</small>
              </td>
              <td className="px-3 py-2.5">
                <code className="text-[12px] font-mono text-rk-faint">{p.apiKeyMasked}</code>
              </td>
              <td className="px-3 py-2.5">
                {p.allowedCategories.length === 0 ? (
                  <span className="text-[12px] text-rk-success">전체 허용</span>
                ) : (
                  <div className="flex gap-0.5 flex-wrap">
                    {p.allowedCategories.map(c => (
                      <span key={c} className="text-[9px] px-1 py-px rounded bg-rk-tint-blue text-rk-info">{CATEGORY_LABEL[c] ?? c}</span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-3 py-2.5 text-[12px] text-rk-muted">
                lead {p.totalLeads}건 · 상품 조회 {p.totalProductFetches}회
                {p.lastUsedAt && <div className="text-[9px] mt-0.5">{p.lastUsedAt.replace("T", " ").slice(0, 16)}</div>}
              </td>
              <td className="px-3 py-2.5">
                <span className={"text-[12px] px-1.5 py-px rounded font-medium " + (p.status === "active" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
                  {p.status}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex gap-1 justify-end flex-wrap">
                  <button type="button" disabled={busy} onClick={() => {
                    if (!window.confirm("API 키를 재발급합니다. 이전 키는 즉시 폐기되며 외부 사이트에 새 키를 등록해야 합니다.")) return;
                    action(p, { action: "rotateKey" }, "키 회전");
                  }} className="bg-rk-warn hover:opacity-90 text-white px-2 py-1 rounded text-[12px] cursor-pointer border-0 disabled:opacity-50">🔄 키 회전</button>
                  {p.status === "active" ? (
                    <button type="button" disabled={busy} onClick={() => action(p, { action: "setStatus", status: "disabled" }, "비활성화")} className="bg-white border border-rk-sale text-rk-sale px-2 py-1 rounded text-[12px] cursor-pointer disabled:opacity-50">비활성</button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => action(p, { action: "setStatus", status: "active" }, "활성화")} className="bg-white border border-rk-success text-rk-success px-2 py-1 rounded text-[12px] cursor-pointer disabled:opacity-50">활성화</button>
                  )}
                  <button type="button" disabled={busy} onClick={() => remove(p)} className="bg-white border border-rk-line text-rk-sale px-2 py-1 rounded text-[12px] cursor-pointer hover:bg-rk-tint-red disabled:opacity-50">삭제</button>
                </div>
              </td>
            </tr>
          ))}
          {partners.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-8 text-center text-rk-muted text-[14px]">등록된 외부 채널이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
