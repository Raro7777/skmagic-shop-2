"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  ageMin: number | null;
  ageMax: number | null;
  creditGrade: string;
  paymentMethods: string;
  helpCallNumber: string;
  memo: string;
};

export default function JoinConditionsEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [ageMin, setAgeMin] = useState<string>(initial.ageMin?.toString() ?? "");
  const [ageMax, setAgeMax] = useState<string>(initial.ageMax?.toString() ?? "");
  const [creditGrade, setCreditGrade] = useState(initial.creditGrade);
  const [paymentMethods, setPaymentMethods] = useState(initial.paymentMethods);
  const [helpCallNumber, setHelpCallNumber] = useState(initial.helpCallNumber);
  const [memo, setMemo] = useState(initial.memo);

  const save = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/hq-setting/join-conditions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageMin: ageMin === "" ? null : Number(ageMin),
          ageMax: ageMax === "" ? null : Number(ageMax),
          creditGrade,
          paymentMethods,
          helpCallNumber,
          memo,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "저장 실패" }); return; }
      setFlash({ tone: "ok", text: "저장되었습니다. 영업자/협력점에 즉시 반영됩니다." });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-rk-ink">SK매직 가입조건</h3>
        <small className="text-[12px] text-rk-muted">영업자/협력점 콘솔의 “📋 가입조건” 버튼에서 노출</small>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-[13px] items-center">
        <label className="text-rk-muted">가입 가능 연령</label>
        <div className="flex items-center gap-1.5">
          <span className="text-rk-muted text-[12px]">만</span>
          <input
            type="number" min={0} max={200}
            value={ageMin}
            onChange={e => setAgeMin(e.target.value)}
            disabled={busy}
            className="w-16 border border-rk-line rounded px-2 py-1 text-[13px]"
          />
          <span className="text-rk-muted">세 ~ 만</span>
          <input
            type="number" min={0} max={200}
            value={ageMax}
            onChange={e => setAgeMax(e.target.value)}
            disabled={busy}
            className="w-16 border border-rk-line rounded px-2 py-1 text-[13px]"
          />
          <span className="text-rk-muted">세</span>
        </div>

        <label className="text-rk-muted">신용등급</label>
        <input
          type="text"
          value={creditGrade}
          onChange={e => setCreditGrade(e.target.value)}
          placeholder="예: 신용 7등급 이하 가능"
          maxLength={80}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px]"
        />

        <label className="text-rk-muted">결제수단</label>
        <input
          type="text"
          value={paymentMethods}
          onChange={e => setPaymentMethods(e.target.value)}
          placeholder="예: 신용카드, 자동이체 (본인 명의 한정)"
          maxLength={200}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px]"
        />

        <label className="text-rk-muted">헬프콜</label>
        <input
          type="text"
          value={helpCallNumber}
          onChange={e => setHelpCallNumber(e.target.value)}
          placeholder="예: 1600-2434"
          maxLength={24}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] font-mono"
        />

        <label className="text-rk-muted self-start">메모</label>
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          rows={4}
          maxLength={600}
          placeholder="추가 안내, 예외 사항, 특수 케이스 등"
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] resize-y"
        />
      </div>

      {flash && (
        <div className={"mt-3 px-3 py-2 rounded text-[13px] " + (flash.tone === "ok" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
          {flash.text}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-4 py-1.5 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
