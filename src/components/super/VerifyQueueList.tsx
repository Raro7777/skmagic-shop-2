"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type VerifyRow = {
  id: string;
  receivedAt: string;
  lastUpdateLabel: string;
  isOverdue: boolean;
  customerName: string;
  phone: string;
  partnerName: string;
  partnerRegion: string | null;
  productInterest: string;
  productCode: string | null;
  selectedMode: string | null;
  selectedContractPeriod: number | null;
  verifyAttempts: number;
  lastReason: string | null;
};

type Decision = "pass" | "fail" | "revise";

const DECISION_META: Record<Decision, { to: string; label: string; tone: string; needsReason: boolean; placeholder: string }> = {
  pass:   { to: "verify_passed",  label: "✅ 인증 완료",   tone: "bg-rk-success hover:brightness-90 text-white",     needsReason: false, placeholder: "" },
  fail:   { to: "verify_failed",  label: "🚨 인증 실패",   tone: "bg-rk-sale text-white",                            needsReason: true,  placeholder: "자격 미달 / 신분증 위조 등 사유" },
  revise: { to: "verify_revise",  label: "✏️ 수정 요청",   tone: "bg-rk-orange hover:bg-rk-orange-deep text-white",   needsReason: true,  placeholder: "보완할 서류 / 정보" },
};

export default function VerifyQueueList({ rows }: { rows: VerifyRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ rowId: string; decision: Decision } | null>(null);
  const [reasonText, setReasonText] = useState("");

  const send = async (rowId: string, decision: Decision, reason?: string) => {
    setError(null);
    setBusyId(rowId);
    try {
      const meta = DECISION_META[decision];
      const r = await fetch(`/api/leads/${rowId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: meta.to, ...(reason ? { reason } : {}) }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "처리 실패");
        return;
      }
      setDecided(prev => new Set(prev).add(rowId));
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusyId(null);
      setModal(null);
      setReasonText("");
    }
  };

  const onDecide = (rowId: string, decision: Decision) => {
    if (DECISION_META[decision].needsReason) {
      setModal({ rowId, decision });
      setReasonText("");
      return;
    }
    if (!confirm("인증 완료 처리합니다. 자동으로 설치대기 단계로 넘어갑니다. 계속?")) return;
    void send(rowId, decision);
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      {error && (
        <div className="bg-rk-tint-red text-rk-sale px-3 py-1.5 rounded text-[13px] mb-2">⚠ {error}</div>
      )}

      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            {["접수", "고객", "협력점", "상품 · 옵션", "재시도", "결정"].map(h => (
              <th key={h} className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isDone = decided.has(r.id);
            return (
              <tr key={r.id} className={isDone ? "opacity-50 line-through" : r.isOverdue ? "bg-rk-tint-orange" : "hover:bg-rk-soft-2"}>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <span className="rk-num text-[13px] text-rk-ink">{r.receivedAt}</span>
                  <small className={"block text-[12px] " + (r.isOverdue ? "text-rk-sale font-medium" : "text-rk-muted")}>
                    인증대기 {r.lastUpdateLabel}{r.isOverdue && " ⚠"}
                  </small>
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <b className="block text-rk-ink">{r.customerName}</b>
                  <small className="text-rk-faint font-mono text-[12px]">{r.phone}</small>
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <b className="block text-rk-ink text-[14px]">{r.partnerName}</b>
                  {r.partnerRegion && <small className="text-rk-faint text-[12px]">{r.partnerRegion}</small>}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <span className="text-rk-ink">{r.productInterest}</span>
                  {r.productCode && <small className="block text-rk-faint font-mono text-[12px]">{r.productCode}</small>}
                  {(r.selectedMode || r.selectedContractPeriod) && (
                    <div className="mt-0.5 flex gap-1 flex-wrap">
                      {r.selectedMode && <span className="text-[12px] px-1 py-px rounded bg-rk-tint-blue text-rk-info">{r.selectedMode}</span>}
                      {r.selectedContractPeriod && <span className="text-[12px] px-1 py-px rounded bg-rk-soft-2 text-rk-muted">{r.selectedContractPeriod}개월</span>}
                    </div>
                  )}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  {r.verifyAttempts > 0 ? (
                    <>
                      <b className="text-rk-orange-deep rk-num">{r.verifyAttempts}회</b>
                      {r.lastReason && <small className="block text-[12px] text-rk-muted">직전: {r.lastReason}</small>}
                    </>
                  ) : (
                    <span className="text-rk-muted">—</span>
                  )}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  {isDone ? (
                    <span className="text-[13px] text-rk-success font-medium">✓ 처리됨</span>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {(["pass", "revise", "fail"] as Decision[]).map(d => (
                        <button
                          key={d}
                          type="button"
                          disabled={busyId === r.id || pending}
                          onClick={() => onDecide(r.id, d)}
                          className={"border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed " + DECISION_META[d].tone}
                        >
                          {busyId === r.id ? "처리…" : DECISION_META[d].label}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {modal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg p-4 w-[400px] shadow-lg" onClick={e => e.stopPropagation()}>
            <h4 className="text-[14px] font-semibold mb-1">
              {DECISION_META[modal.decision].label} 사유
            </h4>
            <p className="text-[13px] text-rk-muted mb-2">
              협력점이 이 내용을 보고 회신을 작성합니다.
            </p>
            <textarea
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              rows={4}
              autoFocus
              className="w-full border border-rk-line rounded p-2 text-[14px] focus:outline-none focus:border-rk-navy"
              placeholder={DECISION_META[modal.decision].placeholder}
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button type="button" onClick={() => setModal(null)}
                className="bg-rk-soft hover:bg-rk-line text-rk-ink border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer">
                취소
              </button>
              <button
                type="button"
                disabled={busyId === modal.rowId || reasonText.trim().length < 3}
                onClick={() => send(modal.rowId, modal.decision, reasonText.trim())}
                className="bg-rk-orange hover:bg-rk-orange-deep text-white border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer disabled:opacity-50"
              >
                {busyId === modal.rowId ? "처리 중…" : "회송"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
