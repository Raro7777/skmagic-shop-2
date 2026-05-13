"use client";

import { useEffect, useState, useCallback } from "react";

type Broadcast = {
  id: string;
  tone: "default" | "urgent" | "event" | string;
  badge: string;
  title: string;
  body: string;
  reach: string | null;
  createdAt: string;
  archivedAt: string | null;
  ageMinutes: number;
};

const BC_TONE: Record<string, string> = {
  default: "border-l-rk-navy",
  urgent:  "border-l-rk-sale bg-[#fffafa]",
  event:   "border-l-rk-orange",
};

const BADGE_PRESETS = [
  { tone: "urgent",  badge: "🚨 긴급 정책" },
  { tone: "event",   badge: "🎁 이벤트" },
  { tone: "default", badge: "📦 마스터 업데이트" },
  { tone: "default", badge: "📦 신상품 입고" },
  { tone: "default", badge: "📋 운영 안내" },
];

export default function BroadcastsManager() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [tone, setTone] = useState("default");
  const [badge, setBadge] = useState("📋 운영 안내");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reach, setReach] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/broadcasts", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.broadcasts);
      setError(null);
    } catch {
      setError("로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);
    if (!title.trim() || !body.trim()) {
      setFormMessage({ tone: "err", text: "title과 body는 필수입니다." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tone, badge, title, body, reach: reach || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormMessage({ tone: "err", text: data.error ?? "작성 실패" });
        return;
      }
      setTitle("");
      setBody("");
      setReach("");
      setShowForm(false);
      setFormMessage({ tone: "ok", text: "공지 발송 완료 — 모든 협력점에 즉시 표시됩니다." });
      await fetchData();
    } catch {
      setFormMessage({ tone: "err", text: "네트워크 오류" });
    } finally {
      setSubmitting(false);
    }
  };

  const archive = async (id: string) => {
    if (!confirm("이 공지를 보관 처리할까요? 협력점에는 더 이상 표시되지 않습니다.")) return;
    const res = await fetch(`/api/broadcasts/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    if (res.ok) fetchData();
  };

  return (
    <>
      <div className="bg-white border border-rk-line rounded-lg p-4 mb-3">
        <div className="flex items-center gap-2.5 mb-3 flex-wrap">
          <h3 className="text-[14px] font-semibold">📢 새 공지 작성</h3>
          <button
            type="button"
            onClick={() => setShowForm(s => !s)}
            className="ml-auto bg-rk-orange hover:bg-rk-orange-deep text-white border-0 px-3 py-1.5 rounded text-[14px] font-medium cursor-pointer transition-colors"
          >
            {showForm ? "폼 닫기" : "+ 공지 작성"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2.5">
              <Field label="톤">
                <select value={tone} onChange={e => setTone(e.target.value)} className={INPUT}>
                  <option value="default">default (일반)</option>
                  <option value="urgent">urgent (긴급)</option>
                  <option value="event">event (이벤트)</option>
                </select>
              </Field>
              <Field label="배지 (이모지 + 라벨)">
                <input value={badge} onChange={e => setBadge(e.target.value)} className={INPUT} placeholder="📋 운영 안내" />
              </Field>
            </div>
            <div className="col-span-1 md:col-span-2 flex flex-wrap gap-1">
              {BADGE_PRESETS.map(p => (
                <button
                  key={p.badge}
                  type="button"
                  onClick={() => { setTone(p.tone); setBadge(p.badge); }}
                  className="text-[12px] px-2 py-1 bg-rk-soft hover:bg-rk-line-2 text-rk-text border-0 rounded cursor-pointer"
                >
                  {p.badge}
                </button>
              ))}
            </div>
            <Field label="제목">
              <input value={title} onChange={e => setTitle(e.target.value)} className={INPUT} required maxLength={200} />
            </Field>
            <Field label="대상 / 영향 (선택)">
              <input value={reach} onChange={e => setReach(e.target.value)} className={INPUT} placeholder="자동 계산: 활성 협력점 수" />
            </Field>
            <div className="col-span-1 md:col-span-2">
              <Field label="본문">
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className={INPUT + " min-h-[80px] resize-y"}
                  rows={4}
                  required
                  maxLength={2000}
                />
              </Field>
            </div>
            <div className="col-span-1 md:col-span-2 flex gap-2 items-baseline justify-end">
              {formMessage && (
                <span
                  className={
                    "text-[13px] " + (formMessage.tone === "ok" ? "text-rk-success" : "text-rk-sale")
                  }
                >
                  {formMessage.tone === "ok" ? "✓ " : "⚠ "}{formMessage.text}
                </span>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="bg-rk-navy hover:bg-rk-navy-deep disabled:bg-rk-muted text-white border-0 px-4 py-1.5 rounded text-[14px] font-semibold cursor-pointer"
              >
                {submitting ? "발송 중…" : "발송"}
              </button>
            </div>
          </form>
        )}

        {!showForm && formMessage?.tone === "ok" && (
          <div className="bg-rk-tint-green text-rk-success text-[13px] px-2.5 py-2 rounded">
            ✓ {formMessage.text}
          </div>
        )}
      </div>

      {error && <div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded mb-2">⚠ {error}</div>}

      {loading ? (
        <div className="bg-white border border-rk-line rounded-lg p-4 text-[14px] text-rk-muted text-center">로딩 중…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-rk-line rounded-lg p-4 text-[14px] text-rk-muted text-center">활성 공지 없음</div>
      ) : (
        items.map(b => (
          <div
            key={b.id}
            className={"bg-white border border-rk-line border-l-[3px] px-3 py-3 rounded-sm text-[14px] mb-2 " + BC_TONE[b.tone]}
          >
            <div className="text-[12px] text-rk-muted flex gap-2 mb-1 items-center flex-wrap">
              <b className={b.tone === "urgent" ? "text-rk-sale" : b.tone === "event" ? "text-rk-orange-deep" : "text-rk-navy"}>{b.badge}</b>
              <span>{formatAge(b.ageMinutes)}</span>
              <button
                type="button"
                onClick={() => archive(b.id)}
                className="ml-auto bg-transparent border-0 text-rk-faint hover:text-rk-sale cursor-pointer text-[13px]"
                title="보관"
              >
                ✕ 보관
              </button>
            </div>
            <h6 className="text-[13px] font-medium text-rk-ink mb-1">{b.title}</h6>
            <p className="text-[14px] text-rk-text m-0 whitespace-pre-line leading-[1.6]">{b.body}</p>
            {b.reach && <div className="text-[12px] text-rk-muted mt-1.5 font-mono">{b.reach}</div>}
          </div>
        ))
      )}
    </>
  );
}

const INPUT =
  "w-full px-2.5 py-1.5 border border-rk-line rounded text-[14px] outline-none focus:border-rk-navy bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] text-rk-muted mb-1 font-medium uppercase tracking-[.04em]">{label}</label>
      {children}
    </div>
  );
}

function formatAge(minutes: number): string {
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}
