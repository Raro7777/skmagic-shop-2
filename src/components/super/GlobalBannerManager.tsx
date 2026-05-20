"use client";

import { useCallback, useEffect, useState } from "react";

type Layout = "classic" | "image-bg" | "product-spotlight" | "promo-stamp" | "image-only";

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  bgColor1: string;
  bgColor2: string;
  textColor: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  startsAt: string;
  endsAt: string;
  priority: number;
  status: "draft" | "active" | string;
  layout: string;
  spotlightProductCode: string | null;
  stampText: string | null;
  htmlContent: string | null;
};

type Draft = {
  title: string;
  subtitle: string;
  imageUrl: string;
  bgColor1: string;
  bgColor2: string;
  textColor: string;
  ctaLabel: string;
  ctaHref: string;
  startsAt: string;
  endsAt: string;
  priority: number;
  status: "draft" | "active";
  layout: Layout;
  spotlightProductCode: string;
  stampText: string;
  htmlContent: string;
};

const LAYOUTS: Array<{ id: Layout; label: string }> = [
  { id: "image-only", label: "🖼 이미지 전용" },
  { id: "classic", label: "클래식" },
  { id: "image-bg", label: "이미지 배경" },
  { id: "product-spotlight", label: "상품 스포트라이트" },
  { id: "promo-stamp", label: "프로모 스탬프" },
];

const PRESETS = [
  { label: "오렌지", c1: "#F26A1F", c2: "#1A2B4D", text: "#FFFFFF" },
  { label: "그린",   c1: "#2EAA5A", c2: "#0F4E2E", text: "#FFFFFF" },
  { label: "블루",   c1: "#3B82F6", c2: "#1E3A8A", text: "#FFFFFF" },
  { label: "다크",   c1: "#1F2937", c2: "#111827", text: "#F9FAFB" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const plusDaysIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const emptyDraft = (): Draft => ({
  title: "", subtitle: "", imageUrl: "",
  bgColor1: PRESETS[0].c1, bgColor2: PRESETS[0].c2, textColor: PRESETS[0].text,
  ctaLabel: "자세히 보기", ctaHref: "",
  startsAt: todayIso(), endsAt: plusDaysIso(14),
  // 신규 배너는 draft 로 만들어 두고 "🚀 푸시" 버튼으로 명시적 게시.
  priority: 100, status: "draft",
  layout: "image-only",
  spotlightProductCode: "", stampText: "", htmlContent: "",
});

export default function GlobalBannerManager() {
  const [list, setList] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/global-banners", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "로드 실패"); return; }
      setList(j.banners);
      setError(null);
    } catch { setError("네트워크 오류"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing("new"); setDraft(emptyDraft()); };
  const startEdit = (b: Banner) => {
    setEditing(b.id);
    setDraft({
      title: b.title, subtitle: b.subtitle ?? "", imageUrl: b.imageUrl ?? "",
      bgColor1: b.bgColor1, bgColor2: b.bgColor2, textColor: b.textColor,
      ctaLabel: b.ctaLabel ?? "", ctaHref: b.ctaHref ?? "",
      startsAt: b.startsAt.slice(0, 10), endsAt: b.endsAt.slice(0, 10),
      priority: b.priority, status: (b.status === "active" ? "active" : "draft"),
      layout: (b.layout as Layout),
      spotlightProductCode: b.spotlightProductCode ?? "",
      stampText: b.stampText ?? "",
      htmlContent: b.htmlContent ?? "",
    });
  };
  const cancel = () => { setEditing(null); setDraft(null); setError(null); };

  const save = async () => {
    if (!draft || !editing) return;
    if (!draft.title.trim()) { setError("배너 제목 필수"); return; }
    if (draft.layout === "image-only" && !draft.imageUrl.trim()) {
      setError("이미지 전용 모드는 이미지 URL 필수"); return;
    }
    setBusy(true);
    try {
      const payload = {
        ...draft,
        startsAt: new Date(draft.startsAt + "T00:00:00").toISOString(),
        endsAt: new Date(draft.endsAt + "T23:59:59").toISOString(),
      };
      const res = editing === "new"
        ? await fetch("/api/admin/global-banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/global-banners/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "저장 실패"); return; }
      cancel(); await load();
    } catch { setError("네트워크 오류"); }
    finally { setBusy(false); }
  };

  const remove = async (b: Banner) => {
    if (!window.confirm(`"${b.title}" 본사 공통 배너를 삭제할까요? (모든 협력점 사이트에서 즉시 사라짐)`)) return;
    const res = await fetch(`/api/admin/global-banners/${b.id}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json(); setError(j.error ?? "삭제 실패"); return; }
    await load();
  };

  // 🚀 푸시 — draft → active 전환. 협력점 컨슈머 사이트 노출 시작 + Broadcast/Telegram 알림.
  const push = async (b: Banner) => {
    if (!window.confirm(`"${b.title}" 본사 공통 배너를 전 협력점에 푸시합니다.\n- 컨슈머 사이트 메인 슬라이드에 즉시 노출\n- 협력점 콘솔에 공지 자동 생성\n- 텔레그램 알림 발송\n진행할까요?`)) return;
    const res = await fetch(`/api/admin/global-banners/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    if (!res.ok) { const j = await res.json(); setError(j.error ?? "푸시 실패"); return; }
    await load();
  };

  // ⏸ 푸시 해제 — active → draft. 컨슈머 노출 즉시 중단 (DB row 보존, 재푸시 가능).
  const unpush = async (b: Banner) => {
    if (!window.confirm(`"${b.title}" 푸시를 해제합니다. 모든 협력점 사이트에서 즉시 사라지지만 DB 에는 draft 로 보존됩니다. 진행할까요?`)) return;
    const res = await fetch(`/api/admin/global-banners/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    if (!res.ok) { const j = await res.json(); setError(j.error ?? "해제 실패"); return; }
    await load();
  };

  return (
    <div>
      <div className="flex items-center mb-3 gap-2 flex-wrap">
        <span className="text-[13px] text-rk-muted">{list.length}개 · 활성 {list.filter(b => b.status === "active").length}개</span>
        <button
          type="button"
          onClick={startNew}
          disabled={editing !== null}
          className="ml-auto bg-rk-orange hover:bg-rk-orange-deep disabled:opacity-50 text-white border-0 px-3.5 py-1.5 rounded text-[13px] font-medium cursor-pointer"
        >
          + 신규 본사 배너
        </button>
      </div>

      {error && <div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded mb-3">⚠ {error}</div>}

      {editing && draft && (
        <div className="bg-white border border-rk-line rounded-lg p-4 mb-3">
          <h3 className="text-[14px] font-semibold mb-3">{editing === "new" ? "신규 본사 공통 배너" : "본사 공통 배너 편집"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
            <Field label="배너 제목 (관리용)">
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="레이아웃">
              <select value={draft.layout} onChange={e => setDraft({ ...draft, layout: e.target.value as Layout })} className="border border-rk-line rounded px-2 py-1 text-[14px] bg-white">
                {LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </Field>
            <Field label={draft.layout === "image-only" ? "이미지 URL *" : "이미지 URL"}>
              <input value={draft.imageUrl} onChange={e => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="https://..." className="border border-rk-line rounded px-2 py-1 text-[14px] font-mono" />
            </Field>
            <Field label={draft.layout === "image-only" ? "보조 카피 (이미지 전용 모드에선 숨김)" : "보조 카피"}>
              <input value={draft.subtitle} onChange={e => setDraft({ ...draft, subtitle: e.target.value })} disabled={draft.layout === "image-only"} className="border border-rk-line rounded px-2 py-1 text-[14px] disabled:bg-rk-soft disabled:text-rk-faint" />
            </Field>
            <Field label="CTA 라벨 (제품명 / '자세히 보기')">
              <input value={draft.ctaLabel} onChange={e => setDraft({ ...draft, ctaLabel: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="CTA 링크 (상세 URL)">
              <input
                value={draft.ctaHref}
                onChange={e => setDraft({ ...draft, ctaHref: e.target.value })}
                placeholder="https://skmagic-shop.com/p/{partnerCode}/products/WPU..."
                className="border border-rk-line rounded px-2 py-1 text-[14px] font-mono"
              />
            </Field>
            <Field label="노출 시작">
              <input type="date" value={draft.startsAt} onChange={e => setDraft({ ...draft, startsAt: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="노출 종료">
              <input type="date" value={draft.endsAt} onChange={e => setDraft({ ...draft, endsAt: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="우선순위 (높을수록 위, 기본 100)">
              <input type="number" value={draft.priority} onChange={e => setDraft({ ...draft, priority: parseInt(e.target.value) || 0 })} className="border border-rk-line rounded px-2 py-1 text-[14px] rk-num" />
            </Field>
            <Field label="상태">
              <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Draft["status"] })} className="border border-rk-line rounded px-2 py-1 text-[14px] bg-white">
                <option value="active">active (즉시 노출)</option>
                <option value="draft">draft (보존)</option>
              </select>
            </Field>
            <Field label="색상 프리셋">
              <div className="flex gap-1">
                {PRESETS.map(p => (
                  <button key={p.label} type="button" onClick={() => setDraft({ ...draft, bgColor1: p.c1, bgColor2: p.c2, textColor: p.text })} className="w-6 h-6 rounded border border-rk-line hover:scale-110 transition-transform" style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }} title={p.label} />
                ))}
              </div>
            </Field>
          </div>
          <div className="flex justify-end gap-1.5 mt-3">
            <button type="button" onClick={cancel} disabled={busy} className="bg-white border border-rk-line text-rk-text px-3 py-1 rounded text-[13px] cursor-pointer">취소</button>
            <button type="button" onClick={save} disabled={busy} className="bg-rk-navy hover:bg-rk-navy-deep disabled:opacity-50 text-white border-0 px-3 py-1 rounded text-[13px] font-medium cursor-pointer">{busy ? "저장 중…" : "저장"}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[14px] text-rk-muted py-6 text-center">로딩 중…</div>
      ) : list.length === 0 ? (
        <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-6 text-center text-[14px] text-rk-muted">아직 등록된 본사 공통 배너가 없습니다.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map(b => (
            <div key={b.id} className="bg-white border border-rk-line rounded-md overflow-hidden">
              <div className="h-[100px] relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${b.bgColor1}, ${b.bgColor2})` }}>
                {b.layout === "image-only" && b.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.imageUrl} alt={b.title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="h-full flex items-center justify-center text-[13px] font-medium px-3" style={{ color: b.textColor }}>
                    {b.title}
                  </div>
                )}
              </div>
              <div className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="text-[13px] text-rk-ink truncate">{b.title}</b>
                  <span className={"text-[11px] px-1.5 py-px rounded font-medium " + (b.status === "active" ? "bg-rk-tint-green text-rk-success" : "bg-rk-soft text-rk-muted")}>{b.status}</span>
                </div>
                <small className="text-[12px] text-rk-muted block">
                  {b.startsAt.slice(0, 10)} ~ {b.endsAt.slice(0, 10)} · priority {b.priority} · {LAYOUTS.find(l => l.id === b.layout)?.label ?? b.layout}
                </small>
                {b.ctaHref && b.ctaHref.includes("{partnerCode}") && (
                  <small className="text-[11px] text-rk-info block">ⓘ 컨슈머 렌더 시 {`{partnerCode}`} 자동 치환</small>
                )}
                <div className="flex gap-2 mt-1.5 items-center flex-wrap">
                  {b.status === "active" ? (
                    <button type="button" onClick={() => unpush(b)} className="text-[12px] text-rk-orange-deep font-semibold hover:underline cursor-pointer bg-transparent border-0">
                      ⏸ 푸시 해제
                    </button>
                  ) : (
                    <button type="button" onClick={() => push(b)} className="text-[12px] text-rk-success font-semibold hover:underline cursor-pointer bg-transparent border-0">
                      🚀 푸시 (전 협력점 노출)
                    </button>
                  )}
                  <button type="button" onClick={() => startEdit(b)} disabled={editing !== null} className="text-[12px] text-rk-info hover:underline disabled:opacity-30 cursor-pointer bg-transparent border-0">편집</button>
                  <button type="button" onClick={() => remove(b)} className="text-[12px] text-rk-sale hover:underline cursor-pointer bg-transparent border-0">삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-rk-muted">{label}</span>
      {children}
    </label>
  );
}
