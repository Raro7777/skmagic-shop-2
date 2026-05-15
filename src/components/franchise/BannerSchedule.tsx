"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  status: string;
  layout?: Layout;
  spotlightProductCode?: string | null;
  stampText?: string | null;
  htmlContent?: string | null;
  sourceTemplateId?: string | null;
};

type Layout = "classic" | "image-bg" | "product-spotlight" | "promo-stamp" | "html";

type Draft = {
  title: string;
  subtitle: string;
  imageUrl: string;
  bgColor1: string;
  bgColor2: string;
  textColor: string;
  ctaLabel: string;
  ctaHref: string;
  startsAt: string; // datetime-local format
  endsAt: string;
  priority: number;
  status: "draft" | "active";
  layout: Layout;
  spotlightProductCode: string;
  stampText: string;
  htmlContent: string;
};

const LAYOUTS: Array<{ id: Layout; label: string; desc: string }> = [
  { id: "classic",           label: "클래식",        desc: "그라데이션 + 텍스트 + CTA" },
  { id: "image-bg",          label: "이미지 배경",   desc: "풀폭 이미지 + 텍스트 오버레이" },
  { id: "product-spotlight", label: "상품 스포트라이트", desc: "좌측 텍스트 + 우측 상품 컷" },
  { id: "promo-stamp",       label: "프로모 스탬프",  desc: "가격·할인 강조" },
  { id: "html",              label: "HTML 직접 입력",  desc: "자유 마크업 (sanitize 후 노출)" },
];

const PRESETS = [
  { label: "오렌지", c1: "#F26A1F", c2: "#1A2B4D", text: "#FFFFFF" },
  { label: "그린",   c1: "#2EAA5A", c2: "#0F4E2E", text: "#FFFFFF" },
  { label: "블루",   c1: "#3B82F6", c2: "#1E3A8A", text: "#FFFFFF" },
  { label: "핑크",   c1: "#EC4899", c2: "#831843", text: "#FFFFFF" },
  { label: "다크",   c1: "#1F2937", c2: "#111827", text: "#F9FAFB" },
];

function toDtLocal(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}
function fromDtLocal(s: string): string {
  return new Date(s).toISOString();
}
function effectiveState(b: Banner): "draft" | "sched" | "live" | "ended" {
  if (b.status === "draft") return "draft";
  const now = new Date();
  const s = new Date(b.startsAt);
  const e = new Date(b.endsAt);
  if (now < s) return "sched";
  if (now > e) return "ended";
  return "live";
}
const STATE_PILL: Record<string, string> = {
  live:  "bg-rk-tint-red text-rk-sale",
  sched: "bg-rk-tint-blue text-rk-info",
  draft: "bg-rk-soft text-rk-muted",
  ended: "bg-rk-soft-2 text-rk-faint",
};
const STATE_LABEL: Record<string, string> = {
  live:  "진행중",
  sched: "예약",
  draft: "초안",
  ended: "종료",
};

const emptyDraft = (): Draft => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    subtitle: "",
    imageUrl: "",
    bgColor1: PRESETS[0].c1,
    bgColor2: PRESETS[0].c2,
    textColor: PRESETS[0].text,
    ctaLabel: "지금 신청",
    ctaHref: "",
    startsAt: toDtLocal(tomorrow.toISOString()),
    endsAt: toDtLocal(weekLater.toISOString()),
    priority: 0,
    status: "active",
    layout: "classic",
    spotlightProductCode: "",
    stampText: "",
    htmlContent: "",
  };
};

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
};

export default function BannerSchedule() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // "new" or banner id
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [stats, setStats] = useState<Record<string, { impressions: number; clicks: number }>>({});
  // 메인 페이지 캐시백 띠 (코드 hardcoded "FLAGSHIP CASHBACK" 영역) 노출 토글
  const [flagshipEnabled, setFlagshipEnabled] = useState<boolean>(true);
  const [flagshipSaving, setFlagshipSaving] = useState(false);
  // hero 캐러셀의 자동 상품 슬라이드 (협력점 등록 배너와 함께 도는 5장) 노출 토글
  const [heroAutoEnabled, setHeroAutoEnabled] = useState<boolean>(true);
  const [heroAutoSaving, setHeroAutoSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [resBanners, resConfig] = await Promise.all([
        fetch("/api/franchise/banners", { cache: "no-store" }),
        fetch("/api/franchise/display-config", { cache: "no-store" }),
      ]);
      if (!resBanners.ok) {
        if (resBanners.status === 401 || resBanners.status === 403) setError("협력점 권한 필요");
        else throw new Error();
        return;
      }
      const j = await resBanners.json();
      setBanners(j.banners);
      setError(null);
      if (resConfig.ok) {
        const c = await resConfig.json();
        setFlagshipEnabled(c.config?.flagshipBannerEnabled !== false);
        setHeroAutoEnabled(c.config?.heroAutoSlidesEnabled !== false);
      }
    } catch {
      setError("배너 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleFlagship = async (next: boolean) => {
    setFlagshipSaving(true);
    setFlash(null);
    try {
      const res = await fetch("/api/franchise/display-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagshipBannerEnabled: next }),
      });
      const j = await res.json();
      if (!res.ok) { setFlash(j.error ?? "토글 실패"); return; }
      setFlagshipEnabled(next);
      setFlash(next ? "캐시백 띠 노출 켜짐" : "캐시백 띠 노출 끔");
    } catch { setFlash("네트워크 오류"); }
    finally { setFlagshipSaving(false); }
  };

  const toggleHeroAuto = async (next: boolean) => {
    setHeroAutoSaving(true);
    setFlash(null);
    try {
      const res = await fetch("/api/franchise/display-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroAutoSlidesEnabled: next }),
      });
      const j = await res.json();
      if (!res.ok) { setFlash(j.error ?? "토글 실패"); return; }
      setHeroAutoEnabled(next);
      setFlash(next ? "자동 hero 슬라이드 노출 켜짐" : "자동 hero 슬라이드 노출 끔");
    } catch { setFlash("네트워크 오류"); }
    finally { setHeroAutoSaving(false); }
  };


  // 통계 로드 (배너 변경 시)
  useEffect(() => {
    void fetch("/api/franchise/banner-stats", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.stats) setStats(j.stats); })
      .catch(() => { /* noop */ });
  }, [banners]);

  const startNew = () => {
    setEditing("new");
    setDraft(emptyDraft());
    setFlash(null);
  };

  const openTemplates = async () => {
    setTemplateModalOpen(true);
    setTemplatesLoading(true);
    try {
      const r = await fetch("/api/admin/banner-templates?status=active", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && Array.isArray(j.templates)) setTemplates(j.templates);
    } catch { /* noop */ }
    finally { setTemplatesLoading(false); }
  };

  const applyTemplate = (t: Template) => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setEditing("new");
    setDraft({
      title: t.title,
      subtitle: t.subtitle ?? "",
      imageUrl: t.imageUrl ?? "",
      bgColor1: t.bgColor1,
      bgColor2: t.bgColor2,
      textColor: t.textColor,
      ctaLabel: t.ctaLabel ?? "지금 신청",
      ctaHref: t.ctaHref ?? "",
      startsAt: toDtLocal(tomorrow.toISOString()),
      endsAt: toDtLocal(weekLater.toISOString()),
      priority: 0,
      status: "active",
      layout: t.layout,
      spotlightProductCode: t.spotlightProductCode ?? "",
      stampText: t.stampText ?? "",
      htmlContent: "",
    });
    setTemplateModalOpen(false);
    setFlash(`템플릿 "${t.name}" 을 가져왔어요. 색상·텍스트·기간을 조정 후 저장하세요.`);
  };
  const startEdit = (b: Banner) => {
    setEditing(b.id);
    setFlash(null);
    setDraft({
      title: b.title,
      subtitle: b.subtitle ?? "",
      imageUrl: b.imageUrl ?? "",
      bgColor1: b.bgColor1,
      bgColor2: b.bgColor2,
      textColor: b.textColor,
      ctaLabel: b.ctaLabel ?? "",
      ctaHref: b.ctaHref ?? "",
      startsAt: toDtLocal(b.startsAt),
      endsAt: toDtLocal(b.endsAt),
      priority: b.priority,
      status: b.status === "active" ? "active" : "draft",
      layout: (b.layout as Layout) ?? "classic",
      spotlightProductCode: b.spotlightProductCode ?? "",
      stampText: b.stampText ?? "",
      htmlContent: b.htmlContent ?? "",
    });
  };
  const cancel = () => { setEditing(null); setDraft(null); };

  const save = async () => {
    if (!draft || !editing) return;
    if (!draft.title.trim()) { setFlash("제목을 입력해주세요"); return; }
    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim() || null,
        imageUrl: draft.imageUrl.trim() || null,
        bgColor1: draft.bgColor1,
        bgColor2: draft.bgColor2,
        textColor: draft.textColor,
        ctaLabel: draft.ctaLabel.trim() || null,
        ctaHref: draft.ctaHref.trim() || null,
        startsAt: fromDtLocal(draft.startsAt),
        endsAt: fromDtLocal(draft.endsAt),
        priority: draft.priority,
        status: draft.status,
        layout: draft.layout,
        spotlightProductCode: draft.spotlightProductCode.trim() || null,
        stampText: draft.stampText.trim() || null,
        htmlContent: draft.layout === "html" ? draft.htmlContent : null,
      };
      const res = editing === "new"
        ? await fetch("/api/franchise/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch(`/api/franchise/banners/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { setFlash(j.error ?? "저장 실패"); return; }
      setFlash(editing === "new" ? "새 배너 등록 완료" : "배너 수정 완료");
      setEditing(null); setDraft(null);
      await load();
    } catch {
      setFlash("네트워크 오류");
    } finally { setSaving(false); }
  };

  const remove = async (b: Banner) => {
    if (!window.confirm(`"${b.title}" 배너를 삭제할까요?`)) return;
    setFlash(null);
    const res = await fetch(`/api/franchise/banners/${b.id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setFlash(j.error ?? "삭제 실패"); return; }
    setFlash(`"${b.title}" 삭제됨`);
    await load();
  };

  const sorted = useMemo(() => {
    const rank = (b: Banner) => {
      const s = effectiveState(b);
      return s === "live" ? 0 : s === "sched" ? 1 : s === "draft" ? 2 : 3;
    };
    return [...banners].sort((a, b) => rank(a) - rank(b) || (b.priority - a.priority));
  }, [banners]);

  if (loading) {
    return <div className="bg-white border border-rk-line rounded-lg p-4 text-center text-[14px] text-rk-muted py-6">배너 로딩 중…</div>;
  }
  if (error) {
    return <div className="bg-white border border-rk-line rounded-lg p-4"><div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded">⚠ {error}</div></div>;
  }

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">🎁 이벤트 / 배너 편성</h3>
        <span className="text-[13px] text-rk-muted">우리 사이트 hero 위에 노출 · 활성 배너 {banners.filter(b => effectiveState(b) === "live").length}개 진행중</span>
        <button
          type="button"
          onClick={openTemplates}
          disabled={editing !== null}
          className="ml-auto bg-white border border-rk-navy text-rk-navy hover:bg-rk-soft disabled:opacity-50 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer"
        >
          🎨 본사 템플릿 가져오기
        </button>
        <button
          type="button"
          onClick={startNew}
          disabled={editing !== null}
          className="bg-rk-orange hover:bg-rk-orange-deep disabled:opacity-50 disabled:cursor-not-allowed text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer"
        >
          + 새 배너 (직접)
        </button>
      </div>

      {/* 캐시백 띠 (자동) 토글 — 메인 페이지 상단의 "+N만원 현금 캐시백" hardcoded 띠 노출 여부.
          렌탈지원금 0 인 상품만 있으면 어차피 자동으로 숨겨지지만, 협력점이 직접 가리고 싶을 때 사용. */}
      <div className="mb-2 bg-rk-soft border border-rk-line rounded px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[18px]">🎁</span>
        <div className="flex-1 min-w-0">
          <b className="text-[13px] text-rk-ink block">메인 캐시백 띠 (자동 노출)</b>
          <small className="text-[12px] text-rk-muted">
            상품에 렌탈지원금이 설정된 경우 메인 페이지 상단에 "개통 시 +N만원 캐시백" 띠가 자동 노출됩니다. 끄면 노출되지 않음.
          </small>
        </div>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={flagshipEnabled}
            disabled={flagshipSaving}
            onChange={e => toggleFlagship(e.target.checked)}
            className="w-4 h-4 accent-rk-orange cursor-pointer"
          />
          <span className={"text-[13px] font-medium " + (flagshipEnabled ? "text-rk-orange-deep" : "text-rk-muted")}>
            {flagshipSaving ? "저장 중…" : flagshipEnabled ? "노출" : "숨김"}
          </span>
        </label>
      </div>

      {/* hero 자동 슬라이드 토글 — 협력점 hero 캐러셀에 자동으로 끼워지는 5개 상품 슬라이드.
          끄면 협력점이 직접 등록한 DB 배너만 노출됨. */}
      <div className="mb-3 bg-rk-soft border border-rk-line rounded px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[18px]">🎞️</span>
        <div className="flex-1 min-w-0">
          <b className="text-[13px] text-rk-ink block">자동 hero 슬라이드 (5장)</b>
          <small className="text-[12px] text-rk-muted">
            메인 hero 캐러셀에 자동으로 추가되는 hero/추천/랭킹 상품 슬라이드. 끄면 협력점이 직접 등록한 배너만 회전합니다.
          </small>
        </div>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={heroAutoEnabled}
            disabled={heroAutoSaving}
            onChange={e => toggleHeroAuto(e.target.checked)}
            className="w-4 h-4 accent-rk-orange cursor-pointer"
          />
          <span className={"text-[13px] font-medium " + (heroAutoEnabled ? "text-rk-orange-deep" : "text-rk-muted")}>
            {heroAutoSaving ? "저장 중…" : heroAutoEnabled ? "노출" : "숨김"}
          </span>
        </label>
      </div>


      {/* 본사 템플릿 가져오기 모달 */}
      {templateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8" onClick={() => setTemplateModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg max-w-[720px] w-full mx-4 shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold">🎨 본사 표준 템플릿</h3>
              <button type="button" onClick={() => setTemplateModalOpen(false)} className="text-rk-muted text-[20px] bg-transparent border-0 cursor-pointer leading-none">×</button>
            </div>
            {templatesLoading ? (
              <div className="text-center py-8 text-rk-muted text-[14px]">로딩 중…</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-rk-muted text-[14px]">본사가 등록한 표준 템플릿이 아직 없습니다.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
                {templates.map(t => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="bg-rk-soft-2 border border-rk-line rounded overflow-hidden text-left cursor-pointer hover:border-rk-navy transition-colors"
                  >
                    <div className="h-[60px] flex items-center justify-center text-[13px] font-medium px-3"
                         style={{ background: `linear-gradient(135deg, ${t.bgColor1}, ${t.bgColor2})`, color: t.textColor }}>
                      {t.title}
                    </div>
                    <div className="px-2.5 py-1.5">
                      <b className="text-[12px] text-rk-ink block">{t.name}</b>
                      <small className="text-[11px] text-rk-muted block">{t.category ?? "—"} · {LAYOUTS.find(l => l.id === t.layout)?.label}</small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {flash && (
        <div className="bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] mb-2">{flash}</div>
      )}

      {/* Editor */}
      {editing && draft && (
        <div className="bg-rk-soft-2 border border-rk-navy rounded-md p-3 mb-3">
          <div className="text-[14px] font-semibold mb-2">
            {editing === "new" ? "새 배너 등록" : "배너 편집"}
          </div>

          {/* 미리보기 + 폼 2열 */}
          <div className="grid grid-cols-[320px_1fr] gap-3 max-md:grid-cols-1">
            {/* preview — 모바일 frame */}
            <div className="bg-white rounded-md border border-rk-line p-2.5 sticky top-3">
              <div className="text-[11px] text-rk-muted mb-1.5 uppercase tracking-[.06em] font-semibold">📱 미리보기</div>
              <div className="bg-rk-soft-2 rounded-[18px] p-1 border-4 border-[#1A1D24]">
                <BannerPreview draft={draft} />
              </div>
              <div className="text-[10.5px] text-rk-faint mt-1.5 leading-[1.5]">
                컨슈머 모바일 사이트의 hero 위치에 표시됩니다.<br />
                {LAYOUTS.find(l => l.id === draft.layout)?.desc}
              </div>
            </div>

            <div>
              {/* 레이아웃 선택 */}
              <Field label="레이아웃 템플릿">
                <div className="grid grid-cols-2 gap-1.5">
                  {LAYOUTS.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, layout: l.id })}
                      className={
                        "text-left px-2 py-1.5 rounded border cursor-pointer text-[12px] transition-colors " +
                        (draft.layout === l.id
                          ? "bg-rk-navy text-white border-rk-navy"
                          : "bg-white border-rk-line text-rk-text hover:border-rk-navy")
                      }
                    >
                      <b className="block">{l.label}</b>
                      <small className={"block text-[10.5px] " + (draft.layout === l.id ? "opacity-80" : "text-rk-muted")}>{l.desc}</small>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-2 text-[13px] mt-2">
                <Field label="제목 *">
                  <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
                </Field>
                <Field label="보조 카피">
                  <input value={draft.subtitle} onChange={e => setDraft({ ...draft, subtitle: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
                </Field>

                {draft.layout !== "html" && (
                  <Field label="이미지 업로드 (≤ 8MB, WebP 자동 변환 · 선택)">
                    <ImageUploadField
                      value={draft.imageUrl}
                      onChange={url => setDraft({ ...draft, imageUrl: url })}
                    />
                    {draft.imageUrl && draft.layout === "classic" && (
                      <small className="text-[11px] text-rk-orange-deep mt-1 block">
                        ⓘ &apos;클래식&apos; 레이아웃은 이미지를 좌측 썸네일로 노출. 풀폭 배경으로 쓰려면 &apos;이미지 배경&apos; 레이아웃 추천.
                      </small>
                    )}
                    {draft.imageUrl && draft.layout === "promo-stamp" && (
                      <small className="text-[11px] text-rk-orange-deep mt-1 block">
                        ⓘ &apos;프로모 스탬프&apos; 는 이미지 영역이 작아 좌측 작은 컷으로 노출됩니다.
                      </small>
                    )}
                  </Field>
                )}

                {draft.layout === "product-spotlight" && (
                  <Field label="강조 상품 코드 (예: WPUIAC506SNS)">
                    <input
                      value={draft.spotlightProductCode}
                      onChange={e => setDraft({ ...draft, spotlightProductCode: e.target.value.trim().toUpperCase() })}
                      placeholder="WPU…"
                      className="border border-rk-line rounded px-2 py-1 text-[14px] font-mono"
                    />
                  </Field>
                )}

                {draft.layout === "promo-stamp" && (
                  <Field label="스탬프 텍스트 (예: 월 ₩39,900, 70만원 할인)">
                    <input
                      value={draft.stampText}
                      onChange={e => setDraft({ ...draft, stampText: e.target.value })}
                      placeholder="월 ₩39,900"
                      className="border border-rk-line rounded px-2 py-1 text-[14px]"
                    />
                  </Field>
                )}

                {draft.layout === "html" && (
                  <div className="col-span-2">
                    <Field label="HTML 마크업 (저장 시 sanitize 적용)">
                      <textarea
                        value={draft.htmlContent}
                        onChange={e => setDraft({ ...draft, htmlContent: e.target.value })}
                        placeholder={`<div style="padding:24px;background:linear-gradient(135deg,#F26A1F,#1A2B4D);color:#fff;border-radius:12px">\n  <h2 style="font-size:22px;margin:0 0 6px">우리 매장 단독 5월 프로모션</h2>\n  <p style="margin:0;font-size:13px">정수기·공청 동시 가입 시 10만원 추가 캐시백</p>\n  <a href="/p/partner-7714c0/products" style="display:inline-block;margin-top:10px;padding:6px 12px;background:#fff;color:#1A2B4D;border-radius:6px;text-decoration:none;font-weight:600">지금 보기 →</a>\n</div>`}
                        rows={10}
                        className="border border-rk-line rounded px-2 py-1.5 text-[12px] font-mono w-full"
                        style={{ minHeight: 180 }}
                      />
                    </Field>
                    {/* 이미지 업로드 → 자동으로 <img> 마크업 삽입 */}
                    <div className="mt-1.5 flex items-start gap-2 bg-rk-soft border border-rk-line-2 rounded px-2.5 py-2">
                      <span className="text-[18px] leading-none">🖼</span>
                      <div className="flex-1">
                        <div className="text-[12px] text-rk-muted mb-1">이미지 업로드 (≤ 8MB, WebP 자동 변환) — 업로드 시 마크업 끝에 자동 삽입</div>
                        <HtmlImageUploader
                          onUploaded={url => {
                            const tag = `\n<img src="${url}" alt="" style="width:100%;border-radius:8px;display:block">\n`;
                            setDraft({ ...draft, htmlContent: (draft.htmlContent ?? "") + tag });
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-rk-muted mt-1 leading-[1.5]">
                      ⚠ <code>&lt;script&gt;</code>·<code>&lt;iframe&gt;</code>·<code>on*</code> 이벤트는 자동 제거됩니다.
                      외부 링크는 새 탭 + nofollow 로 변환. 최대 10,000자.
                      이미지·CSS·flex/grid 레이아웃은 그대로 동작.
                    </p>
                  </div>
                )}

                <Field label="시작일 *">
                  <input type="datetime-local" value={draft.startsAt} onChange={e => setDraft({ ...draft, startsAt: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
                </Field>
                <Field label="종료일 *">
                  <input type="datetime-local" value={draft.endsAt} onChange={e => setDraft({ ...draft, endsAt: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
                </Field>
                <Field label="CTA 버튼">
                  <input value={draft.ctaLabel} onChange={e => setDraft({ ...draft, ctaLabel: e.target.value })} placeholder="예: 지금 신청" className="border border-rk-line rounded px-2 py-1 text-[14px]" />
                </Field>
                <Field label="CTA 링크 (상품 상세 등)">
                  <input value={draft.ctaHref} onChange={e => setDraft({ ...draft, ctaHref: e.target.value })} placeholder="/p/.../products/..." className="border border-rk-line rounded px-2 py-1 text-[14px]" />
                </Field>
                <Field label="우선순위 (큰 값 우선)">
                  <input type="number" value={draft.priority} onChange={e => setDraft({ ...draft, priority: Math.max(0, parseInt(e.target.value) || 0) })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
                </Field>
                <Field label="상태">
                  <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as "draft" | "active" })} className="border border-rk-line rounded px-2 py-1 text-[14px] bg-white">
                    <option value="active">활성 (예약/진행 자동 분기)</option>
                    <option value="draft">초안 (사이트에 미노출)</option>
                  </select>
                </Field>
                <Field label="색상 프리셋">
                  <div className="flex gap-1">
                    {PRESETS.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setDraft({ ...draft, bgColor1: p.c1, bgColor2: p.c2, textColor: p.text })}
                        className="w-6 h-6 rounded border border-rk-line hover:scale-110 transition-transform"
                        style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }}
                        title={p.label}
                      />
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-1.5 mt-3">
            <button type="button" onClick={cancel} disabled={saving} className="bg-white border border-rk-line text-rk-text px-3 py-1 rounded text-[13px] cursor-pointer">취소</button>
            <button type="button" onClick={save} disabled={saving} className="bg-rk-navy hover:bg-rk-navy-deep disabled:opacity-50 text-white border-0 px-3 py-1 rounded text-[13px] font-medium cursor-pointer">
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {sorted.length === 0 ? (
        <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-6 text-center text-[14px] text-rk-muted">
          아직 등록된 배너가 없습니다. + 새 배너로 만들어보세요.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map(b => {
            const state = effectiveState(b);
            const fade = state === "ended" || state === "draft";
            return (
              <div key={b.id} className={"grid grid-cols-[80px_60px_1fr_90px_auto_auto_auto] gap-3 items-center bg-rk-soft-2 border border-rk-line-2 px-3 py-2.5 rounded text-[14px] " + (fade ? "opacity-60" : "")}>
                <div className="font-mono font-medium text-[12px] leading-[1.4]">
                  {fmtRange(b.startsAt, b.endsAt)}
                </div>
                <div className="w-[60px] h-8 rounded" style={{ background: `linear-gradient(135deg, ${b.bgColor1}, ${b.bgColor2})` }} />
                <div className="min-w-0">
                  <b className="block text-rk-ink font-medium truncate">{b.title}</b>
                  {b.subtitle && <small className="text-rk-muted text-[12px] truncate block">{b.subtitle}</small>}
                  <small className="text-[11px] text-rk-faint">{LAYOUTS.find(l => l.id === (b.layout as Layout))?.label ?? "클래식"}{b.sourceTemplateId ? " · 본사 템플릿" : ""}</small>
                </div>
                <BannerStatsCell stats={stats[b.id]} />
                <span className={"text-[12px] px-1.5 py-px rounded font-medium " + STATE_PILL[state]}>{STATE_LABEL[state]}</span>
                <button type="button" onClick={() => startEdit(b)} disabled={editing !== null} className="text-rk-info text-[13px] hover:underline disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">편집</button>
                <button type="button" onClick={() => remove(b)} className="text-rk-sale text-[13px] hover:underline cursor-pointer">삭제</button>
              </div>
            );
          })}
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

function BannerStatsCell({ stats }: { stats?: { impressions: number; clicks: number } }) {
  if (!stats || stats.impressions === 0) {
    return <span className="text-[11px] text-rk-faint">노출 0</span>;
  }
  const ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions * 100) : 0;
  return (
    <div className="text-[11px] leading-[1.4]">
      <div className="text-rk-text rk-num">노출 <b>{stats.impressions.toLocaleString()}</b></div>
      <div className="text-rk-info rk-num">클릭 <b>{stats.clicks.toLocaleString()}</b> ({ctr.toFixed(1)}%)</div>
    </div>
  );
}

function fmtRange(startsAt: string, endsAt: string): string {
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(new Date(startsAt))} ~ ${fmt(new Date(endsAt))}`;
}

/** 협력점 배너용 이미지 업로드 input — multipart POST → Blob */
function ImageUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/franchise/banners/upload-image", { method: "POST", body: fd });
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

/** HTML 레이아웃용 이미지 업로더 — 업로드 후 호출자가 마크업 삽입 */
function HtmlImageUploader({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/franchise/banners/upload-image", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setErr(j.error ?? "업로드 실패"); return; }
      onUploaded(j.url);
      setRecent(j.url);
    } catch {
      setErr("네트워크 오류");
    } finally { setUploading(false); }
  };

  return (
    <div className="flex flex-col gap-1.5">
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
      {recent && (
        <div className="flex items-center gap-2">
          <img src={recent} alt="" className="w-[60px] h-[40px] object-cover rounded border border-rk-line" />
          <small className="text-[11px] text-rk-success">✓ 마크업에 &lt;img&gt; 자동 삽입됨</small>
          <button
            type="button"
            onClick={() => { void navigator.clipboard.writeText(recent); }}
            className="text-[11px] text-rk-info hover:underline cursor-pointer bg-transparent border-0 ml-auto"
          >
            URL 복사
          </button>
        </div>
      )}
    </div>
  );
}

/** 모바일 frame 안에 실제 hero 렌더 — Draft 기반 */
function BannerPreview({ draft }: { draft: Draft }) {
  const bgStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${draft.bgColor1}, ${draft.bgColor2})`,
    color: draft.textColor,
  };
  const title = draft.title || "(제목 미입력)";

  if (draft.layout === "image-bg") {
    return (
      <div className="rounded-[12px] overflow-hidden relative min-h-[180px] flex flex-col justify-end" style={bgStyle}>
        {draft.imageUrl && (
          <img src={draft.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative px-3 py-3" style={{ color: draft.textColor }}>
          <b className="block text-[14px] font-bold leading-tight" style={{ textShadow: "0 1px 4px rgba(0,0,0,.5)", color: "inherit" }}>{title}</b>
          {draft.subtitle && <div className="text-[12px] mt-0.5 opacity-90">{draft.subtitle}</div>}
          {draft.ctaLabel && (
            <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white text-rk-ink text-[12px] font-semibold">
              {draft.ctaLabel}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (draft.layout === "product-spotlight") {
    return (
      <div className="rounded-[12px] px-3 py-3 grid grid-cols-[1fr_70px] gap-2 items-center min-h-[140px]" style={bgStyle}>
        <div>
          <b className="block text-[14px] font-bold leading-tight">{title}</b>
          {draft.subtitle && <div className="text-[12px] mt-1 opacity-85">{draft.subtitle}</div>}
          {draft.ctaLabel && (
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-white/20 text-[11px] font-medium">
              {draft.ctaLabel}
            </span>
          )}
          {draft.spotlightProductCode && (
            <div className="mt-1 text-[10px] opacity-60 font-mono">{draft.spotlightProductCode}</div>
          )}
        </div>
        <div className="w-[70px] h-[70px] rounded-md bg-white/20 grid place-items-center text-[10px] text-center opacity-90">
          {draft.imageUrl ? (
            <img src={draft.imageUrl} alt="" className="w-full h-full object-contain rounded" />
          ) : (
            "상품\n이미지"
          )}
        </div>
      </div>
    );
  }

  if (draft.layout === "promo-stamp") {
    return (
      <div className="rounded-[12px] px-3 py-4 relative min-h-[140px] flex items-center gap-3" style={bgStyle}>
        {draft.imageUrl && (
          <img src={draft.imageUrl} alt="" className="w-[72px] h-[72px] rounded-md object-cover shrink-0 border border-white/20" />
        )}
        <div className="flex-1 text-center">
          <b className="block text-[12px] uppercase tracking-[.1em] opacity-75">{draft.subtitle || "이벤트"}</b>
          <div className="text-[20px] font-bold mt-1 leading-tight">{title}</div>
          {draft.stampText && (
            <div className="inline-block mt-2 px-3 py-1.5 rounded-md text-[16px] font-bold tracking-[-.02em]" style={{ background: draft.textColor, color: draft.bgColor2 }}>
              {draft.stampText}
            </div>
          )}
          {draft.ctaLabel && (
            <div>
              <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white text-rk-ink text-[12px] font-semibold">
                {draft.ctaLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // classic
  return (
    <div className={"rounded-[12px] px-3 py-3 min-h-[120px] " + (draft.imageUrl ? "flex items-center gap-3 text-left" : "text-center flex flex-col justify-center")} style={bgStyle}>
      {draft.imageUrl && (
        <img src={draft.imageUrl} alt="" className="w-[80px] h-[80px] rounded-md object-cover shrink-0 border border-white/20" />
      )}
      <div className={draft.imageUrl ? "flex-1" : ""}>
        <b className="block text-[14px] font-bold leading-tight">{title}</b>
        {draft.subtitle && <div className="text-[12px] opacity-85 mt-1">{draft.subtitle}</div>}
        {draft.ctaLabel && (
          <span className={"inline-block mt-2 px-3 py-1 rounded-full bg-white/20 text-[12px] font-medium " + (draft.imageUrl ? "" : "mx-auto")}>
            {draft.ctaLabel}
          </span>
        )}
      </div>
    </div>
  );
}
