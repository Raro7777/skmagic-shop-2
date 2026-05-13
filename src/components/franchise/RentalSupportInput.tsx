"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default function RentalSupportInput({ initial }: { initial: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(String(initial));
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const rawParsed = Math.max(0, Math.floor(Number(value.replace(/[^\d]/g, "")) || 0));
  // 만원 단위 절사 — 입력 시점에도 미리 보여줘 협력점이 헷갈리지 않게
  const parsed = Math.floor(rawParsed / 10000) * 10000;
  const truncated = rawParsed > parsed ? rawParsed - parsed : 0;
  const dirty = parsed !== initial;

  const save = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/franchise/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalSupportAmount: parsed }),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "저장 실패" }); return; }
      setFlash({ tone: "ok", text: `저장됨. 상품 옵션마다 수수료 한도 내에서 자동 노출됩니다.` });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[14px] font-semibold text-rk-ink">🎁 렌탈지원금 (협력점 단독 환원)</h3>
        <small className="text-[12px] text-rk-muted">개통 시 1회 캐시백 · 본사 지급 후 정산 시 차감</small>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-[13px] items-center">
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
          <span className="text-[12px] text-rk-muted">원 · 개통 1회 환원</span>
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
        <li>모든 상품·옵션 공통 단일 금액. 옵션별 차등 X.</li>
        <li><b>만원 단위로 절사</b>되어 저장·노출 (예: ₩662,000 → ₩660,000).</li>
        <li><b>상품 옵션의 수수료 합계 ≥ 설정 금액</b> 인 경우만 그 옵션에 노출. 부족하면 그 옵션은 <b>0</b> 표기.</li>
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
