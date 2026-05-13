"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PipelineSnapshot, PipelineRow, StageKey } from "@/lib/franchiseDashboard";
import { STATUS_PILL, type LeadStatus } from "@/lib/leadStatus";
import EnrollmentFormModal, { type ExistingFormData } from "./EnrollmentFormModal";

const STAGE_BG: Record<string, string> = {
  consult:    "bg-rk-tint-blue",
  pending_hq: "bg-rk-tint-orange",
  respond:    "bg-rk-tint-red",
  done:       "bg-rk-tint-green",
  closed:     "bg-rk-soft-2",
  neutral:    "bg-rk-soft-2",
};
const STAGE_TEXT: Record<string, string> = {
  consult:    "text-rk-info",
  pending_hq: "text-rk-orange-deep",
  respond:    "text-rk-sale",
  done:       "text-rk-success",
  closed:     "text-rk-muted",
  neutral:    "text-rk-ink",
};

const ROW_BG: Record<string, string> = {
  active:  "bg-rk-tint-orange",
  respond: "bg-rk-tint-red",
  fade:    "opacity-65",
};

const BTN: Record<string, string> = {
  orange: "bg-rk-orange hover:bg-rk-orange-deep text-white",
  navy:   "bg-rk-navy hover:bg-rk-navy-deep text-white",
  sale:   "bg-rk-sale text-white",
  ghost:  "bg-rk-soft hover:bg-rk-line text-rk-ink",
};

const NOTE_TONE: Record<string, string> = {
  muted:  "text-rk-muted",
  warn:   "text-rk-sale",
  urgent: "text-rk-orange-deep",
};

const INSTALL_TONE: Record<string, string> = {
  muted:   "text-rk-muted",
  warn:    "text-rk-sale",
  default: "text-rk-ink rk-num",
};

export default function OrderPipeline({ data }: { data: PipelineSnapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonRow, setReasonRow] = useState<{ id: string; to: LeadStatus } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [enrollmentModal, setEnrollmentModal] = useState<{ row: PipelineRow; existing: ExistingFormData | null; autoAdvance: boolean } | null>(null);

  const sendUpdate = async (leadId: string, toStatus: LeadStatus, reason?: string) => {
    setError(null);
    setBusyId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus, ...(reason ? { reason } : {}) }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "상태 변경 실패");
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusyId(null);
      setReasonRow(null);
      setReasonText("");
    }
  };

  const openEnrollment = async (row: PipelineRow, autoAdvance: boolean) => {
    setError(null);
    try {
      const r = await fetch(`/api/leads/${row.id}/enrollment`);
      const j = await r.json();
      setEnrollmentModal({ row, existing: j.form ?? null, autoAdvance });
    } catch (e) {
      setError(e instanceof Error ? e.message : "신청서 로드 실패");
    }
  };

  const onAction = (row: PipelineRow, action: NonNullable<PipelineRow["action" | "secondaryAction"]>) => {
    // form_ready 가 to 이면 모달 (신청서 작성/수정)
    if (action.toStatus === "form_ready") {
      const autoAdvance = row.stage !== "form_ready"; // 이미 form_ready 에서 누른 ✎수정 은 autoAdvance=false
      void openEnrollment(row, autoAdvance);
      return;
    }
    // 회신 작성 / 종료 처럼 메모가 의미 있는 경우 모달
    const needsReason =
      action.toStatus === "revise_resubmit" ||
      action.toStatus === "consult_closed" ||
      action.toStatus === "install_cancel";
    if (needsReason) {
      setReasonRow({ id: row.id, to: action.toStatus });
      setReasonText("");
      return;
    }
    void sendUpdate(row.id, action.toStatus);
  };

  return (
    <section className="bg-white border border-rk-line rounded-lg p-4 pb-[18px] mb-3">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">📦 주문 파이프라인 · 이번 주 {data.weekTotal}건</h3>
        <div className="ml-auto flex gap-2 items-center">
          <span className="text-[14px] text-rk-muted">실시간 DB</span>
        </div>
      </div>

      {error && (
        <div className="bg-rk-tint-red text-rk-sale px-3 py-1.5 rounded text-[13px] mb-2">⚠ {error}</div>
      )}

      <div className="grid grid-cols-6 gap-2 mb-3.5">
        {data.stages.map(s => (
          <div key={s.key as StageKey} className={"rounded p-2.5 px-3 " + STAGE_BG[s.tone]}>
            <small className={"text-[12px] font-medium uppercase tracking-[.04em] block " + STAGE_TEXT[s.tone]}>
              {s.label}
            </small>
            <div className={"text-[22px] font-bold mt-1 rk-num " + STAGE_TEXT[s.tone]}>{s.count}</div>
            <div className="text-[12px] text-rk-muted">{s.hint}</div>
          </div>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-6 text-center text-[14px] text-rk-muted">
          아직 lead가 없습니다. 영업자 링크를 통해 신규 lead가 들어오면 여기에 표시됩니다.
        </div>
      ) : (
        <table className="w-full text-[14px] border-collapse">
          <thead>
            <tr>
              {["접수", "고객", "상품 · 사은품", "월 렌탈료", "설치 일정", "단계", "다음 할 일"].map((h, i) => (
                <th
                  key={i}
                  style={{ width: i === 0 ? 110 : i === 6 ? 220 : undefined }}
                  className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map(o => (
              <tr key={o.id} className={o.rowTone ? ROW_BG[o.rowTone] : undefined}>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <b className="rk-num text-rk-ink">{o.receivedAt}</b>
                  <br />
                  <span className={"font-mono text-[13px] " + NOTE_TONE[o.receivedNoteTone]}>
                    {o.receivedNote}
                  </span>
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <b className="text-rk-ink">{o.customerName}</b>
                  <br />
                  <span className="text-rk-muted font-mono text-[13px]">{o.customerMeta}</span>
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  {o.product}
                  {(o.selectedMode || o.selectedContractPeriod || o.rivalCompensationRequested) && (
                    <div className="mt-0.5 flex gap-1 flex-wrap">
                      {o.selectedMode && (
                        <span className="text-[12px] px-1 py-px rounded bg-rk-tint-blue text-rk-info">
                          {o.selectedMode}
                        </span>
                      )}
                      {o.selectedContractPeriod && (
                        <span className="text-[12px] px-1 py-px rounded bg-rk-soft-2 text-rk-muted">
                          {o.selectedContractPeriod}개월
                        </span>
                      )}
                      {o.rivalCompensationRequested && (
                        <span className="text-[12px] px-1 py-px rounded bg-rk-tint-orange text-rk-orange-deep font-medium">
                          🔄 타사보상
                        </span>
                      )}
                    </div>
                  )}
                  {o.giftLabel && (
                    <small className={"block mt-0.5 " + (o.giftAmount > 0 ? "text-rk-orange-deep" : "text-rk-muted")}>
                      + {o.giftLabel}
                      {o.giftAmount > 0 && ` (₩${o.giftAmount.toLocaleString()})`}
                    </small>
                  )}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">
                  {o.rentalPrice != null ? `₩${o.rentalPrice.toLocaleString()}` : "—"}
                </td>
                <td className={"px-1.5 py-2.5 border-b border-rk-line-2 " + INSTALL_TONE[o.installScheduleTone]}>
                  {o.installScheduleLabel}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <span className={"text-[12px] px-1.5 py-px rounded font-medium " + (STATUS_PILL[o.stage] ?? "")}>
                    {o.stageLabel}
                  </span>
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  {o.action ? (
                    <div className="flex gap-1 flex-wrap">
                      <button
                        type="button"
                        disabled={busyId === o.id || pending}
                        onClick={() => onAction(o, o.action!)}
                        className={"border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed " + BTN[o.action.tone]}
                      >
                        {busyId === o.id ? "처리 중…" : o.action.label}
                      </button>
                      {o.secondaryAction && (
                        <button
                          type="button"
                          disabled={busyId === o.id || pending}
                          onClick={() => onAction(o, o.secondaryAction!)}
                          className={"border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed " + BTN[o.secondaryAction.tone]}
                        >
                          {o.secondaryAction.label}
                        </button>
                      )}
                    </div>
                  ) : o.stage === "settle_done" ? (
                    <span className="text-[13px] text-rk-success">✓ 정산 완료</span>
                  ) : o.stage === "settle_pending" || o.stage === "install_done" ? (
                    <span className="text-[13px] text-rk-success">✓ 정산 진행</span>
                  ) : o.stage === "install_pending" || o.stage === "verify_pending" || o.stage === "verify_passed" || o.stage === "apply_submitted" ? (
                    <span className="text-[13px] text-rk-muted">⏳ 본사 처리 대기</span>
                  ) : o.stage === "consult_closed" || o.stage === "install_cancel" ? (
                    <span className="text-[13px] text-rk-muted">— 종료</span>
                  ) : (
                    <span className="text-[13px] text-rk-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Enrollment 모달 */}
      {enrollmentModal && (
        <EnrollmentFormModal
          leadId={enrollmentModal.row.id}
          prefill={enrollmentModal.row.enrollmentPrefill}
          existing={enrollmentModal.existing}
          autoAdvance={enrollmentModal.autoAdvance}
          onClose={() => setEnrollmentModal(null)}
          onSaved={() => {
            setEnrollmentModal(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {/* Reason 입력 모달 */}
      {reasonRow && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setReasonRow(null)}>
          <div className="bg-white rounded-lg p-4 w-[360px] shadow-lg" onClick={e => e.stopPropagation()}>
            <h4 className="text-[14px] font-semibold mb-2">메모 입력</h4>
            <p className="text-[13px] text-rk-muted mb-2">
              {reasonRow.to === "revise_resubmit" && "본사로 보낼 회신 내용을 입력하세요."}
              {reasonRow.to === "consult_closed" && "종료 사유를 입력하세요."}
              {reasonRow.to === "install_cancel" && "설치 취소 사유를 입력하세요."}
            </p>
            <textarea
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              rows={3}
              className="w-full border border-rk-line rounded p-2 text-[14px] focus:outline-none focus:border-rk-navy"
              placeholder="필요한 추가 메모를 적어주세요"
              autoFocus
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button
                type="button"
                onClick={() => setReasonRow(null)}
                className="bg-rk-soft hover:bg-rk-line text-rk-ink border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busyId === reasonRow.id}
                onClick={() => sendUpdate(reasonRow.id, reasonRow.to, reasonText.trim() || undefined)}
                className="bg-rk-orange hover:bg-rk-orange-deep text-white border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer disabled:opacity-50"
              >
                {busyId === reasonRow.id ? "처리 중…" : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
