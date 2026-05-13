"use client";

import { useState } from "react";

type CategoryId = "water" | "air" | "bidet" | "mattress" | "all";

const CATEGORIES: Array<{ id: CategoryId; label: string }> = [
  { id: "water", label: "💧 정수기" },
  { id: "air", label: "💨 공기청정기" },
  { id: "bidet", label: "🚿 비데" },
  { id: "mattress", label: "🛏 매트리스" },
  { id: "all", label: "전체 추천" },
];

const CATEGORY_TO_INTEREST: Record<CategoryId, string> = {
  water: "정수기",
  air: "공기청정기",
  bidet: "비데",
  mattress: "매트리스",
  all: "전체 추천",
};

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function ConsultFormClient({
  partnerCode,
  partnerName,
}: {
  partnerCode: string;
  partnerName: string;
}) {
  const [cat, setCat] = useState<CategoryId>("water");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const phoneDigits = phone.replace(/\D/g, "");
    if (!name.trim()) { setErr("이름을 입력해주세요."); return; }
    if (phoneDigits.length !== 11 || !phoneDigits.startsWith("010")) {
      setErr("휴대폰 번호를 정확히 입력해주세요 (010-0000-0000).");
      return;
    }

    setSubmitting(true);
    setErr(null);
    try {
      const productInterest = memo.trim()
        ? `${CATEGORY_TO_INTEREST[cat]} · ${memo.trim()}`
        : CATEGORY_TO_INTEREST[cat];

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          phone: phoneDigits,
          productInterest,
          partnerId: partnerCode,
          landingType: "consumer_partner",
          utm: {
            landingPath: typeof window !== "undefined" ? window.location.pathname : undefined,
            referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
            deviceType: "pc",
          },
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error ?? "상담 신청에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      setDone(j.message ?? `${partnerName}에서 30분 이내 연락드립니다.`);
      setName(""); setPhone(""); setMemo("");
    } catch {
      setErr("네트워크 오류 — 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="consult-form">
        <h3>✅ 접수 완료</h3>
        <div className="sub" style={{ marginBottom: 14 }}>{done}</div>
        <button type="button" className="submit" onClick={() => setDone(null)}>
          한 건 더 신청
        </button>
      </div>
    );
  }

  return (
    <form className="consult-form" onSubmit={handleSubmit}>
      <h3>상담 신청</h3>
      <div className="sub">본사 인증 상담사 직접 연결 · 평일 09:00–18:00</div>

      <div className="field">
        <label>관심 카테고리</label>
        <div className="chips">
          {CATEGORIES.map(c => (
            <button
              type="button"
              key={c.id}
              className={`chip ${cat === c.id ? "on" : ""}`}
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>이름</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="홍길동"
            autoComplete="name"
            required
          />
        </div>
        <div className="field">
          <label>연락처</label>
          <input
            value={phone}
            onChange={e => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            inputMode="numeric"
            autoComplete="tel"
            required
          />
        </div>
      </div>

      <div className="field">
        <label>관심 모델 / 문의 (선택)</label>
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="예) MEGA ICE 얼음정수기 가격, 설치 일정 안내 부탁드립니다."
        />
      </div>

      {err && (
        <div style={{ fontSize: 12.5, color: "#E5341F", fontWeight: 700, marginTop: 6 }}>
          {err}
        </div>
      )}

      <button className="submit" type="submit" disabled={submitting}>
        {submitting ? "접수 중…" : "상담 신청하기"}
      </button>
      <div className="consent">
        신청 시 개인정보 수집·이용에 동의합니다 · 30분 이내 {partnerName} 상담사 연결
      </div>
    </form>
  );
}
