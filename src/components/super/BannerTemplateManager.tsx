"use client";

import { useCallback, useEffect, useState } from "react";

type Layout = "classic" | "image-bg" | "product-spotlight" | "promo-stamp" | "image-only";

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
  fullClickable: boolean;
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
  fullClickable: boolean;
  stampText: string;
  spotlightProductCode: string;
  status: "active" | "archived";
};

const LAYOUTS: Array<{ id: Layout; label: string; desc?: string }> = [
  { id: "classic", label: "클래식" },
  { id: "image-bg", label: "이미지 배경" },
  { id: "product-spotlight", label: "상품 스포트라이트" },
  { id: "promo-stamp", label: "프로모 스탬프" },
  { id: "image-only", label: "🖼 이미지 전용", desc: "텍스트·CTA 없이 이미지만 풀-블리드 (텍스트 baked 이미지용)" },
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
  ctaLabel: "지금 신청", ctaHref: "", fullClickable: false, stampText: "", spotlightProductCode: "",
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
      fullClickable: !!t.fullClickable,
      stampText: t.stampText ?? "", spotlightProductCode: t.spotlightProductCode ?? "",
      status: t.status,
    });
  };
  const cancel = () => { setEditing(null); setDraft(null); };

  const save = async () => {
    if (!draft || !editing) return;
    if (!draft.name.trim() || !draft.title.trim()) { setError("name, title 필수"); return; }
    if (draft.layout === "image-only" && !draft.imageUrl.trim()) {
      setError("이미지 전용 모드는 이미지 URL 이 필요합니다");
      return;
    }
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
              {LAYOUTS.find(l => l.id === draft.layout)?.desc && (
                <small className="text-[11px] text-rk-muted mt-1 block">{LAYOUTS.find(l => l.id === draft.layout)?.desc}</small>
              )}
            </Field>
            <Field label={draft.layout === "image-only" ? "배너 제목 * (관리용 — 컨슈머에 노출 안 됨)" : "배너 제목 *"}>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
                placeholder={draft.layout === "image-only" ? "이미지 전용 모드 — 관리 라벨로만 사용" : ""}
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label={draft.layout === "image-only" ? "보조 카피 (이미지 전용 모드에선 숨김)" : "보조 카피"}>
              <input value={draft.subtitle} onChange={e => setDraft({ ...draft, subtitle: e.target.value })}
                placeholder={draft.layout === "image-only" ? "이미지 전용 모드에선 표시되지 않음" : ""}
                disabled={draft.layout === "image-only"}
                className="border border-rk-line rounded px-2 py-1 text-[14px] disabled:bg-rk-soft disabled:text-rk-faint" />
            </Field>
            <Field label={draft.layout === "image-only" ? "이미지 업로드 * (≤ 8MB, WebP 자동 변환)" : "이미지 업로드 (≤ 8MB, WebP 자동 변환 · 선택)"}>
              <ImageUploadField
                value={draft.imageUrl}
                onChange={url => setDraft({ ...draft, imageUrl: url })}
              />
              <input
                value={draft.imageUrl}
                onChange={e => setDraft({ ...draft, imageUrl: e.target.value })}
                placeholder="또는 https://... URL 직접 입력"
                className="border border-rk-line rounded px-2 py-1 text-[12px] font-mono mt-1"
              />
            </Field>
            <Field label={draft.layout === "image-only" ? "제품명 / CTA 라벨 (이미지 위 버튼 숨김, 전체 클릭만 사용)" : "CTA 버튼 (제품명 / 라벨)"}>
              <input value={draft.ctaLabel} onChange={e => setDraft({ ...draft, ctaLabel: e.target.value })}
                placeholder="예: 자세히 보기 / MEGA ICE 얼음정수기"
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="상세 URL (CTA 링크)">
              <input value={draft.ctaHref} onChange={e => setDraft({ ...draft, ctaHref: e.target.value })}
                placeholder="https://skmagic-shop.com/p/{partnerCode}/products/..."
                className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="배너 전체 영역 클릭">
              <label className="flex items-center gap-2 text-[13px] text-rk-ink cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={draft.fullClickable}
                  onChange={e => setDraft({ ...draft, fullClickable: e.target.checked })}
                  className="accent-rk-navy"
                />
                <span>활성 — CTA 버튼뿐 아니라 <b>배너 전체 영역 클릭</b> 시에도 상세 URL 로 이동</span>
              </label>
              {draft.layout === "image-only" && !draft.fullClickable && (
                <small className="text-[11px] text-rk-orange-deep mt-1 block">⚠ 이미지 전용 모드는 CTA 버튼이 숨겨지므로 전체 클릭을 켜야 링크가 동작합니다.</small>
              )}
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
              {/* 미리보기 — image-only 면 이미지만 풀-블리드, 그 외엔 그라데이션 + 제목 */}
              <div className="h-[80px] relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${t.bgColor1}, ${t.bgColor2})` }}>
                {t.layout === "image-only" && t.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.imageUrl} alt={t.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="h-full flex items-center justify-center text-[13px] font-medium px-3" style={{ color: t.textColor }}>
                    {t.title}
                  </div>
                )}
              </div>
              <div className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="text-[13px] text-rk-ink truncate">{t.name}</b>
                  <span className={"text-[11px] px-1.5 py-px rounded font-medium " + (t.status === "active" ? "bg-rk-tint-green text-rk-success" : "bg-rk-soft text-rk-muted")}>{t.status}</span>
                </div>
                <small className="text-[12px] text-rk-muted block">
                  {t.category ?? "—"} · {LAYOUTS.find(l => l.id === t.layout)?.label ?? t.layout}
                  {t.fullClickable && <span className="ml-1 text-[10px] px-1 py-px rounded bg-rk-tint-blue text-rk-info font-medium">전체 클릭</span>}
                </small>
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

/** 본사 배너 템플릿용 이미지 업로드 — 협력점 ImageUploadField 와 동일 패턴, endpoint 만 본사 전용. */
function ImageUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/banner-templates/upload-image", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setErr(j.error ?? "업로드 실패"); return; }
      onChange(j.url);
    } catch {
      setErr("네트워크 오류");
    } finally { setUploading(false); }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {value && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="업로드 미리보기" className="w-[80px] h-[50px] object-cover rounded border border-rk-line" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[11px] text-rk-sale hover:underline cursor-pointer bg-transparent border-0"
          >
            제거
          </button>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
        className="text-[12px]"
      />
      {uploading && <small className="text-[11px] text-rk-info">⏳ 업로드 중…</small>}
      {err && <small className="text-[11px] text-rk-sale">⚠ {err}</small>}
    </div>
  );
}
