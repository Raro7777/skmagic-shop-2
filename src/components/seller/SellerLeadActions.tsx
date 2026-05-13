"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadStatus } from "@/lib/leadStatus";
import EnrollmentFormModal, { type ExistingFormData } from "../franchise/EnrollmentFormModal";

type EnrollmentPrefill = {
  customerName: string;
  phone: string;
  productCode: string;
  productName: string;
  managementMode: "방문형" | "셀프형" | null;
  contractPeriod: number;
  visitInterval: string | null;
  monthlyPrice: number;
  isRivalCompensation: boolean;
  giftAmount: number;
  giftLabel: string | null;
};

type ActionDef = { label: string; to: LeadStatus; tone: "orange" | "navy" | "sale" | "ghost"; needsReason?: boolean; openEnrollment?: boolean };

const ACTIONS: Partial<Record<LeadStatus, ActionDef[]>> = {
  consult_wish:    [{ label: "📞 상담 시작", to: "consult_active",  tone: "orange" }],
  consult_active:  [
    { label: "📝 신청서 작성", to: "form_ready",      tone: "navy", openEnrollment: true },
    { label: "❌ 종료",         to: "consult_closed",  tone: "ghost", needsReason: true },
  ],
  form_ready: [
    { label: "📤 본사 제출",   to: "apply_submitted", tone: "orange" },
    { label: "✎ 수정",          to: "form_ready",      tone: "ghost", openEnrollment: true },
  ],
  verify_failed:   [{ label: "↩ 회신 작성", to: "revise_resubmit", tone: "sale", needsReason: true }],
  verify_revise:   [{ label: "↩ 보완 회신", to: "revise_resubmit", tone: "sale", needsReason: true }],
  revise_resubmit: [{ label: "📝 신청서 보완", to: "form_ready", tone: "navy", openEnrollment: true }],
};

const TONE: Record<string, string> = {
  orange: "bg-rk-orange hover:bg-rk-orange-deep text-white",
  navy:   "bg-rk-navy hover:bg-rk-navy-deep text-white",
  sale:   "bg-rk-sale text-white",
  ghost:  "bg-rk-soft hover:bg-rk-line text-rk-ink",
};

export default function SellerLeadActions({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonTo, setReasonTo] = useState<LeadStatus | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [enrollmentModal, setEnrollmentModal] = useState<{ prefill: EnrollmentPrefill; existing: ExistingFormData | null; autoAdvance: boolean } | null>(null);

  const acts = ACTIONS[status] ?? [];

  const send = async (target: LeadStatus, reason?: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target, ...(reason ? { reason } : {}) }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "처리 실패");
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(false);
      setReasonTo(null);
      setReasonText("");
    }
  };

  const openEnrollment = async (autoAdvance: boolean) => {
    setError(null);
    try {
      const r = await fetch(`/api/leads/${leadId}/enrollment`);
      const j = await r.json();
      if (!j.prefill) { setError("lead 정보 로드 실패"); return; }
      setEnrollmentModal({ prefill: j.prefill, existing: j.form ?? null, autoAdvance });
    } catch (e) {
      setError(e instanceof Error ? e.message : "신청서 로드 실패");
    }
  };

  const onClick = (a: ActionDef) => {
    if (a.openEnrollment) {
      const autoAdvance = status !== "form_ready";
      void openEnrollment(autoAdvance);
      return;
    }
    if (a.needsReason) {
      setReasonTo(a.to);
      setReasonText("");
      return;
    }
    void send(a.to);
  };

  if (acts.length === 0) {
    if (status === "settle_done") return <span className="text-[13px] text-rk-success">✓ 정산 완료</span>;
    if (status === "consult_closed" || status === "install_cancel") return <span className="text-[13px] text-rk-muted">— 종료</span>;
    if (status === "settle_pending" || status === "install_done") return <span className="text-[13px] text-rk-success">✓ 정산 진행</span>;
    return <span className="text-[13px] text-rk-muted">⏳ 본사 처리 중</span>;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {acts.map(a => (
        <button
          key={a.to}
          type="button"
          disabled={busy || pending}
          onClick={() => onClick(a)}
          className={"border-0 px-3 py-1 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed " + TONE[a.tone]}
        >
          {busy ? "처리 중…" : a.label}
        </button>
      ))}
      {error && <span className="text-rk-sale text-[13px]">⚠ {error}</span>}

      {enrollmentModal && (
        <EnrollmentFormModal
          leadId={leadId}
          prefill={enrollmentModal.prefill}
          existing={enrollmentModal.existing}
          autoAdvance={enrollmentModal.autoAdvance}
          onClose={() => setEnrollmentModal(null)}
          onSaved={() => { setEnrollmentModal(null); startTransition(() => router.refresh()); }}
        />
      )}

      {reasonTo && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setReasonTo(null)}>
          <div className="bg-white rounded-lg p-4 w-[360px]" onClick={e => e.stopPropagation()}>
            <h4 className="text-[14px] font-semibold mb-2">메모 입력</h4>
            <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} rows={3} autoFocus
              className="w-full border border-rk-line rounded p-2 text-[14px] focus:outline-none focus:border-rk-navy"
              placeholder="사유 또는 회신 내용" />
            <div className="flex gap-2 mt-3 justify-end">
              <button type="button" onClick={() => setReasonTo(null)}
                className="bg-rk-soft hover:bg-rk-line text-rk-ink border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer">취소</button>
              <button type="button" disabled={busy} onClick={() => send(reasonTo, reasonText.trim() || undefined)}
                className="bg-rk-orange hover:bg-rk-orange-deep text-white border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer disabled:opacity-50">
                {busy ? "처리 중…" : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
