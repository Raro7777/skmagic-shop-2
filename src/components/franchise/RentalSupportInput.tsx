"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default function RentalSupportInput({
  initial,
  initialEnabled = true,
}: {
  initial: number;
  initialEnabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(String(initial));
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const rawParsed = Math.max(0, Math.floor(Number(value.replace(/[^\d]/g, "")) || 0));
  // 만원 단위 절사 — 입력 시점에도 미리 보여줘 협력점이 헷갈리지 않게
  const parsed = Math.floor(rawParsed / 10000) * 10000;
  const truncated = rawParsed > parsed ? rawParsed - parsed : 0;
  const dirty = parsed !== initial || enabled !== initialEnabled;

  const save = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/franchise/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalSupportAmount: parsed, rentalSupportEnabled: enabled }),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "저장 실패" }); return; }
      setFlash({
        tone: "ok",
        text: enabled
          ? `저장됨. 소비자 사이트에 상품 옵션별 수수료 한도 내에서 자동 노출.`
          : `저장됨. 렌탈지원금이 소비자 사이트에서 숨김 처리됩니다 (정산 로직과 무관).`,
      });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[14px] font-semibold text-rk-ink">🎁 렌탈지원금 (협력점 보장 마진 설정)</h3>
        <small className="text-[12px] text-rk-muted">영업점수수료에서 이 금액을 제외한 나머지가 고객에게 환원</small>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-[13px] items-center">
        {/* 소비자 사이트 노출 토글 */}
        <span className="text-rk-muted">소비자 사이트 표시</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEnabled(v => !v)}
            disabled={busy}
            title={enabled ? "끄면 소비자 사이트에 렌탈지원금 박스가 숨겨집니다" : "켜면 소비자 사이트에 렌탈지원금이 노출됩니다"}
            className={
              "relative w-10 h-[22px] rounded-full transition-colors border-0 cursor-pointer disabled:opacity-50 " +
              (enabled ? "bg-rk-success" : "bg-rk-line")
            }
          >
            <span
              className="absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-all"
              style={{ left: enabled ? 20 : 2 }}
            />
          </button>
          <span className={"text-[13px] font-medium " + (enabled ? "text-rk-success" : "text-rk-muted")}>
            {enabled ? "ON · 노출 중" : "OFF · 숨김 (정산 로직과 무관)"}
          </span>
        </div>

        <label htmlFor="rentalSupport" className="text-rk-muted">지원 금액 (총액)</label>
        <div className="flex items-center gap-2">
          <span className="text-rk-muted">₩</span>
          <input
            id="rentalSupport"
            type="text"
            inputMode="numeric"
            value={value === "0" ? "" : fmt(parsed)}
            onChange={e => setValue(e.target.value)}
            placeholder="예: 300,000"
            disabled={busy}
            className="border border-rk-line rounded px-2.5 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy disabled:opacity-50 rk-num w-[180px]"
          />
          <span className="text-[12px] text-rk-muted">원 · 협력점이 챙길 보장 마진</span>
        </div>
        {truncated > 0 && (
          <>
            <div />
            <small className="text-[11px] text-rk-orange-deep">
              만원 단위 절사 → 실제 저장·노출은 <b>₩{fmt(parsed)}</b> ({fmt(truncated)}원 절사)
            </small>
          </>
        )}
      </div>

      <ul className="mt-3 bg-rk-tint-blue text-rk-info text-[12px] p-3 rounded-md leading-[1.6] list-disc pl-5">
        <li><b>이 금액은 협력점이 보장받을 마진</b>. 모든 상품·옵션 공통 단일 금액.</li>
        <li>고객 환원 렌탈지원금 = <b>영업점수수료 − 이 마진 − 사은품 − 설치 환원</b> (자동 계산).</li>
        <li>옵션별로 영업점수수료가 다르므로 옵션마다 노출되는 렌탈지원금 액수도 달라짐. 차액이 음수면 0.</li>
        <li><b>만원 단위로 절사</b>되어 노출 (예: ₩662,000 → ₩660,000).</li>
        <li>0 입력 시 렌탈지원금 미노출.</li>
        <li>개통 (install_done) 시점에 본사가 고객에 1회 캐시백 지급 → 정산 시 협력점 수수료에서 차감.</li>
        <li>가입 취소·환불 시 전체 환수.</li>
      </ul>

      {flash && (
        <div
          className={
            "mt-3 px-3 py-2 rounded text-[13px] " +
            (flash.tone === "ok"
              ? "bg-rk-tint-green text-rk-success"
              : "bg-rk-tint-red text-rk-sale")
          }
        >
          {flash.text}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={busy || pending || !dirty}
          className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-4 py-1.5 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={() => { setValue(String(initial)); setFlash(null); }}
          disabled={busy || !dirty}
          className="bg-white hover:bg-rk-soft-2 text-rk-ink border border-rk-line rounded px-3 py-1.5 text-[13px] cursor-pointer disabled:opacity-50"
        >
          되돌리기
        </button>
        {dirty && (
          <small className="text-[12px] text-rk-orange-deep ml-2">⚠ 저장하지 않은 변경사항</small>
        )}
      </div>
    </div>
  );
}
