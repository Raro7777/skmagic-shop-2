"use client";

import { useCallback, useEffect, useState } from "react";

type Layout = "classic" | "image-bg" | "product-spotlight" | "promo-stamp";

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  layout: Layout;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  bgColor1: string;
  bgColor2: string;
  textColor: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  stampText: string | null;
  spotlightProductCode: string | null;
  status: "active" | "archived";
  createdAt: string;
};

type Draft = {
  name: string;
  description: string;
  category: string;
  layout: Layout;
  title: string;
  subtitle: string;
  imageUrl: string;
  bgColor1: string;
  bgColor2: string;
  textColor: string;
  ctaLabel: string;
  ctaHref: string;
  stampText: string;
  spotlightProductCode: string;
  status: "active" | "archived";
};

const LAYOUTS: Array<{ id: Layout; label: string }> = [
  { id: "classic", label: "클래식" },
  { id: "image-bg", label: "이미지 배경" },
  { id: "product-spotlight", label: "상품 스포트라이트" },
  { id: "promo-stamp", label: "프로모 스탬프" },
];

const PRESETS = [
  { label: "오렌지", c1: "#F26A1F", c2: "#1A2B4D", text: "#FFFFFF" },
  { label: "그린",   c1: "#2EAA5A", c2: "#0F4E2E", text: "#FFFFFF" },
  { label: "블루",   c1: "#3B82F6", c2: "#1E3A8A", text: "#FFFFFF" },
  { label: "핑크",   c1: "#EC4899", c2: "#831843", text: "#FFFFFF" },
  { label: "다크",   c1: "#1F2937", c2: "#111827", text: "#F9FAFB" },
];

const emptyDraft = (): Draft => ({
  name: "", description: "", category: "", layout: "classic",
  title: "", subtitle: "", imageUrl: "",
  bgColor1: PRESETS[0].c1, bgColor2: PRESETS[0].c2, textColor: PRESETS[0].text,
  ctaLabel: "지금 신청", ctaHref: "", stampText: "", spotlightProductCode: "",
  status: "active",
});

export default function BannerTemplateManager() {
  const [list, setList] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/banner-templates", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "조회 실패"); return; }
      setList(j.templates);
      setError(null);
    } catch { setError("네트워크 오류"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing("new"); setDraft(emptyDraft()); };
  const startEdit = (t: Template) => {
    setEditing(t.id);
    setDraft({
      name: t.name, description: t.description ?? "", category: t.category ?? "",
      layout: t.layout, title: t.title, subtitle: t.subtitle ?? "", imageUrl: t.imageUrl ?? "",
      bgColor1: t.bgColor1, bgColor2: t.bgColor2, textColor: t.textColor,
      ctaLabel: t.ctaLabel ?? "", ctaHref: t.ctaHref ?? "",
      stampText: t.stampText ?? "", spotlightProductCode: t.spotlightProductCode ?? "",
      status: t.status,
    });
  };
  const cancel = () => { setEditing(null); setDraft(null); };

  const save = async () => {
    if (!draft || !editing) return;
    if (!draft.name.trim() || !draft.title.trim()) { setError("name, title 필수"); return; }
    setBusy(true);
    try {
      const res = editing === "new"
        ? await fetch("/api/admin/banner-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) })
        : await fetch(`/api/admin/banner-templates/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "저장 실패"); return; }
      cancel(); await load();
    } catch { setError("네트워크 오류"); }
    finally { setBusy(false); }
  };

  const remove = async (t: Template) => {
    if (!window.confirm(`"${t.name}" 템플릿을 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/banner-templates/${t.id}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json(); setError(j.error ?? "삭제 실패"); return; }
    await load();
  };

  if (loading) return <div className="bg-white border border-rk-line rounded-lg p-4 text-center text-rk-muted text-[14px] py-6">로딩 중…</div>;

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">🎨 표준 템플릿</h3>
        <span className="text-[13px] text-rk-muted">{list.length}개 (active {list.filter(t => t.status === "active").length} · archived {list.filter(t => t.status === "archived").length})</span>
        <button type="button" onClick={startNew} disabled={editing !== null}
          className="ml-auto bg-rk-orange hover:bg-rk-orange-deep disabled:opacity-50 text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer">
          + 신규 템플릿
        </button>
      </div>

      {error && <div className="bg-rk-tint-red text-rk-sale text-[13px] px-3 py-2 rounded mb-2">⚠ {error}</div>}

      {/* Editor */}
      {editing && draft && (
        <div className="bg-rk-soft-2 border border-rk-navy rounded-md p-3 mb-3">
          <div className="text-[14px] font-semibold mb-2">{editing === "new" ? "신규 템플릿" : "편집"}</div>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <Field label="템플릿 이름 *">
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="예: 어버이날 효도 패키지"
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="카테고리 (시즌/이벤트)">
              <input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}
                placeholder="예: 어버이날, 여름, 신모델"
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="설명 (협력점 안내용)">
              <input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}
                placeholder="이 템플릿이 어떤 상황에 적합한지"
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="레이아웃">
              <select value={draft.layout} onChange={e => setDraft({ ...draft, layout: e.target.value as Layout })}
                className="border border-rk-line rounded px-2 py-1 text-[14px] bg-white">
                {LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="배너 제목 *">
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="보조 카피">
              <input value={draft.subtitle} onChange={e => setDraft({ ...draft, subtitle: e.target.value })}
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="이미지 URL (선택)">
              <input value={draft.imageUrl} onChange={e => setDraft({ ...draft, imageUrl: e.target.value })}
                placeholder="https://..."
                className="border border-rk-line rounded px-2 py-1 text-[14px] font-mono" />
            </Field>
            <Field label="CTA 버튼">
              <input value={draft.ctaLabel} onChange={e => setDraft({ ...draft, ctaLabel: e.target.value })}
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="CTA 링크">
              <input value={draft.ctaHref} onChange={e => setDraft({ ...draft, ctaHref: e.target.value })}
                placeholder="/p/{partnerCode}/products/..."
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="스탬프 텍스트 (promo-stamp)">
              <input value={draft.stampText} onChange={e => setDraft({ ...draft, stampText: e.target.value })}
                placeholder="월 ₩39,900"
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="강조 상품 코드 (product-spotlight)">
              <input value={draft.spotlightProductCode} onChange={e => setDraft({ ...draft, spotlightProductCode: e.target.value.trim().toUpperCase() })}
                placeholder="WPU…"
                className="border border-rk-line rounded px-2 py-1 text-[14px] font-mono" />
            </Field>
            <Field label="상태">
              <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Draft["status"] })}
                className="border border-rk-line rounded px-2 py-1 text-[14px] bg-white">
                <option value="active">active (협력점 노출)</option>
                <option value="archived">archived (보존)</option>
              </select>
            </Field>
            <Field label="색상 프리셋">
              <div className="flex gap-1">
                {PRESETS.map(p => (
                  <button key={p.label} type="button"
                    onClick={() => setDraft({ ...draft, bgColor1: p.c1, bgColor2: p.c2, textColor: p.text })}
                    className="w-6 h-6 rounded border border-rk-line hover:scale-110 transition-transform"
                    style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }}
                    title={p.label} />
                ))}
              </div>
            </Field>
          </div>
          <div className="flex justify-end gap-1.5 mt-3">
            <button type="button" onClick={cancel} disabled={busy} className="bg-white border border-rk-line text-rk-text px-3 py-1 rounded text-[13px] cursor-pointer">취소</button>
            <button type="button" onClick={save} disabled={busy} className="bg-rk-navy hover:bg-rk-navy-deep disabled:opacity-50 text-white border-0 px-3 py-1 rounded text-[13px] font-medium cursor-pointer">
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {list.length === 0 ? (
        <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-6 text-center text-[14px] text-rk-muted">
          아직 등록된 템플릿이 없습니다. + 신규 템플릿으로 추가하세요.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {list.map(t => (
            <div key={t.id} className="bg-rk-soft-2 border border-rk-line rounded-md overflow-hidden">
              <div className="h-[80px] flex items-center justify-center text-[13px] font-medium px-3"
                   style={{ background: `linear-gradient(135deg, ${t.bgColor1}, ${t.bgColor2})`, color: t.textColor }}>
                {t.title}
              </div>
              <div className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="text-[13.5px] text-rk-ink truncate">{t.name}</b>
                  <span className={"text-[11px] px-1.5 py-px rounded font-medium " + (t.status === "active" ? "bg-rk-tint-green text-rk-success" : "bg-rk-soft text-rk-muted")}>{t.status}</span>
                </div>
                <small className="text-[11.5px] text-rk-muted block">{t.category ?? "—"} · {LAYOUTS.find(l => l.id === t.layout)?.label ?? t.layout}</small>
                {t.description && <p className="text-[11px] text-rk-text mt-1 m-0 leading-[1.4] line-clamp-2">{t.description}</p>}
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => startEdit(t)} disabled={editing !== null}
                    className="text-[12px] text-rk-info hover:underline disabled:opacity-30 cursor-pointer bg-transparent border-0">편집</button>
                  <button type="button" onClick={() => remove(t)}
                    className="text-[12px] text-rk-sale hover:underline cursor-pointer bg-transparent border-0">삭제</button>
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
