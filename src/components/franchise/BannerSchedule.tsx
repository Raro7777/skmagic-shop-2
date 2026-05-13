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
};

type Draft = {
  title: string;
  subtitle: string;
  bgColor1: string;
  bgColor2: string;
  textColor: string;
  ctaLabel: string;
  ctaHref: string;
  startsAt: string; // datetime-local format
  endsAt: string;
  priority: number;
  status: "draft" | "active";
};

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
    bgColor1: PRESETS[0].c1,
    bgColor2: PRESETS[0].c2,
    textColor: PRESETS[0].text,
    ctaLabel: "지금 신청",
    ctaHref: "",
    startsAt: toDtLocal(tomorrow.toISOString()),
    endsAt: toDtLocal(weekLater.toISOString()),
    priority: 0,
    status: "active",
  };
};

export default function BannerSchedule() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // "new" or banner id
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/franchise/banners", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setError("협력점 권한 필요");
        else throw new Error();
        return;
      }
      const j = await res.json();
      setBanners(j.banners);
      setError(null);
    } catch {
      setError("배너 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setEditing("new");
    setDraft(emptyDraft());
    setFlash(null);
  };
  const startEdit = (b: Banner) => {
    setEditing(b.id);
    setFlash(null);
    setDraft({
      title: b.title,
      subtitle: b.subtitle ?? "",
      bgColor1: b.bgColor1,
      bgColor2: b.bgColor2,
      textColor: b.textColor,
      ctaLabel: b.ctaLabel ?? "",
      ctaHref: b.ctaHref ?? "",
      startsAt: toDtLocal(b.startsAt),
      endsAt: toDtLocal(b.endsAt),
      priority: b.priority,
      status: b.status === "active" ? "active" : "draft",
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
        bgColor1: draft.bgColor1,
        bgColor2: draft.bgColor2,
        textColor: draft.textColor,
        ctaLabel: draft.ctaLabel.trim() || null,
        ctaHref: draft.ctaHref.trim() || null,
        startsAt: fromDtLocal(draft.startsAt),
        endsAt: fromDtLocal(draft.endsAt),
        priority: draft.priority,
        status: draft.status,
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
          onClick={startNew}
          disabled={editing !== null}
          className="ml-auto bg-rk-orange hover:bg-rk-orange-deep disabled:opacity-50 disabled:cursor-not-allowed text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer"
        >
          + 새 배너
        </button>
      </div>

      {flash && (
        <div className="bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] mb-2">{flash}</div>
      )}

      {/* Editor */}
      {editing && draft && (
        <div className="bg-rk-soft-2 border border-rk-navy rounded-md p-3 mb-3">
          <div className="text-[14px] font-semibold mb-2">
            {editing === "new" ? "새 배너 등록" : "배너 편집"}
          </div>
          {/* preview */}
          <div
            className="rounded p-3 mb-3 text-center"
            style={{
              background: `linear-gradient(135deg, ${draft.bgColor1}, ${draft.bgColor2})`,
              color: draft.textColor,
            }}
          >
            <div className="text-[14px] font-bold leading-tight">{draft.title || "(제목 미입력)"}</div>
            {draft.subtitle && <div className="text-[13px] opacity-80 mt-1">{draft.subtitle}</div>}
            {draft.ctaLabel && (
              <span className="inline-block mt-2 px-3 py-1 rounded bg-white/20 text-[13px] font-medium">
                {draft.ctaLabel}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <Field label="제목 *">
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
            <Field label="보조 카피">
              <input value={draft.subtitle} onChange={e => setDraft({ ...draft, subtitle: e.target.value })} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
            </Field>
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
              <div key={b.id} className={"grid grid-cols-[80px_60px_1fr_auto_auto_auto] gap-3 items-center bg-rk-soft-2 border border-rk-line-2 px-3 py-2.5 rounded text-[14px] " + (fade ? "opacity-60" : "")}>
                <div className="font-mono font-medium text-[12px] leading-[1.4]">
                  {fmtRange(b.startsAt, b.endsAt)}
                </div>
                <div className="w-[60px] h-8 rounded" style={{ background: `linear-gradient(135deg, ${b.bgColor1}, ${b.bgColor2})` }} />
                <div className="min-w-0">
                  <b className="block text-rk-ink font-medium truncate">{b.title}</b>
                  {b.subtitle && <small className="text-rk-muted text-[12px] truncate block">{b.subtitle}</small>}
                </div>
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

function fmtRange(startsAt: string, endsAt: string): string {
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(new Date(startsAt))} ~ ${fmt(new Date(endsAt))}`;
}
