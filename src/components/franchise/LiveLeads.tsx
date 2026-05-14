"use client";

import { useEffect, useState, useCallback } from "react";
import { STATUS_LABEL, STATUS_PILL, type LeadStatus } from "@/lib/leadStatus";
import EnrollmentFormModal, { type ExistingFormData } from "./EnrollmentFormModal";

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

type LeadView = {
  id: string;
  createdAt: string;
  customerName: string;
  phoneMasked: string;
  productInterest: string;
  region: string;
  status: LeadStatus;
  duplicateStatus: "confirmed" | "possible" | "bad_db" | null;
  seller: { name: string; sellerCode: string } | null;
  minutesAgo: number;
};

// 협력점이 직접 누를 수 있는 다음 액션 — leadStatus.ts 전이 매트릭스와 일치
type ActionDef = { label: string; to: LeadStatus; tone: "orange" | "success" | "navy" | "ghost" | "warn" | "sale"; needsReason?: boolean; openEnrollment?: boolean };
const ACTIONS: Partial<Record<LeadStatus, ActionDef[]>> = {
  consult_wish:    [
    { label: "✓ 상담 시작",     to: "consult_active",  tone: "orange" },
    { label: "❌ 종료",          to: "consult_closed",  tone: "ghost", needsReason: true },
  ],
  consult_active:  [
    { label: "📝 신청서 작성",  to: "form_ready",      tone: "navy",  openEnrollment: true },
    { label: "❌ 종료",          to: "consult_closed",  tone: "ghost", needsReason: true },
  ],
  form_ready: [
    { label: "📤 본사 제출",    to: "apply_submitted", tone: "orange" },
    { label: "✎ 수정",           to: "form_ready",      tone: "ghost", openEnrollment: true },
  ],
  verify_failed:   [
    { label: "📝 수정 후 재제출", to: "revise_resubmit", tone: "orange", openEnrollment: true },
    { label: "↩ 회신만 작성",     to: "revise_resubmit", tone: "ghost", needsReason: true },
  ],
  verify_revise:   [
    { label: "📝 수정 후 재제출", to: "revise_resubmit", tone: "orange", openEnrollment: true },
    { label: "↩ 회신만 작성",     to: "revise_resubmit", tone: "ghost", needsReason: true },
  ],
  revise_resubmit: [
    { label: "📝 신청서 보완",  to: "form_ready",      tone: "navy", openEnrollment: true },
  ],
};
const TONE_CLASS: Record<ActionDef["tone"], string> = {
  orange:  "bg-rk-orange hover:bg-rk-orange-deep text-white",
  success: "bg-rk-success hover:brightness-90 text-white",
  navy:    "bg-rk-navy hover:bg-rk-navy-deep text-white",
  ghost:   "bg-rk-soft hover:bg-rk-line text-rk-ink",
  warn:    "bg-rk-warn text-white",
  sale:    "bg-rk-sale text-white",
};

// Phase 별 카운트
const PHASE_OF: Record<LeadStatus, "consult" | "pending_hq" | "respond" | "done" | "closed"> = {
  consult_wish:    "consult",
  consult_active:  "consult",
  consult_closed:  "closed",
  form_ready:      "consult",
  apply_submitted: "pending_hq",
  verify_pending:  "pending_hq",
  verify_passed:   "pending_hq",
  install_pending: "pending_hq",
  verify_failed:   "respond",
  verify_revise:   "respond",
  revise_resubmit: "respond",
  install_done:    "done",
  settle_pending:  "done",
  settle_done:     "done",
  install_cancel:  "closed",
};

export default function LiveLeads() {
  const [leads, setLeads] = useState<LeadView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  const [reasonRow, setReasonRow] = useState<{ id: string; to: LeadStatus } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [enrollmentModal, setEnrollmentModal] = useState<{ leadId: string; prefill: EnrollmentPrefill; existing: ExistingFormData | null; autoAdvance: boolean } | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setLeads(prev => {
        const newIds = data.leads.map((l: LeadView) => l.id);
        const oldIds = prev.map(l => l.id);
        const hasNew = newIds.some((id: string) => !oldIds.includes(id));
        if (hasNew && prev.length > 0) {
          setPulse(true);
          setTimeout(() => setPulse(false), 1500);
        }
        return data.leads;
      });
      setError(null);
    } catch {
      setError("실시간 데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  const changeStatus = async (lead: LeadView, to: LeadStatus, reason?: string) => {
    setBusyId(lead.id);
    setError(null);
    const prevStatus = lead.status;
    setLeads(ls => ls.map(l => (l.id === lead.id ? { ...l, status: to } : l)));
    try {
      const res = await fetch(`/api/leads/${lead.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to, ...(reason ? { reason } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setLeads(ls => ls.map(l => (l.id === lead.id ? { ...l, status: prevStatus } : l)));
        setError(data?.error ?? "상태 변경 실패");
      } else {
        fetchLeads();
      }
    } catch {
      setLeads(ls => ls.map(l => (l.id === lead.id ? { ...l, status: prevStatus } : l)));
      setError("네트워크 오류");
    } finally {
      setBusyId(null);
      setReasonRow(null);
      setReasonText("");
    }
  };

  const openEnrollment = async (leadId: string, autoAdvance: boolean) => {
    setError(null);
    try {
      const r = await fetch(`/api/leads/${leadId}/enrollment`);
      const j = await r.json();
      if (!j.prefill) { setError("lead 정보 로드 실패"); return; }
      setEnrollmentModal({ leadId, prefill: j.prefill, existing: j.form ?? null, autoAdvance });
    } catch (e) {
      setError(e instanceof Error ? e.message : "신청서 로드 실패");
    }
  };

  const onAction = (lead: LeadView, a: ActionDef) => {
    if (a.openEnrollment) {
      const autoAdvance = lead.status !== "form_ready";
      void openEnrollment(lead.id, autoAdvance);
      return;
    }
    if (a.needsReason) {
      setReasonRow({ id: lead.id, to: a.to });
      setReasonText("");
      return;
    }
    void changeStatus(lead, a.to);
  };

  useEffect(() => {
    fetchLeads();
    const t = setInterval(fetchLeads, 5000);
    return () => clearInterval(t);
  }, [fetchLeads]);

  const counts = leads.reduce<Record<string, number>>(
    (acc, l) => {
      const phase = PHASE_OF[l.status];
      acc[phase] = (acc[phase] ?? 0) + 1;
      return acc;
    },
    { consult: 0, pending_hq: 0, respond: 0, done: 0, closed: 0 }
  );

  return (
    <section className="bg-white border border-rk-line rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold flex items-center gap-2">
          <span
            className={"inline-block w-1.5 h-1.5 rounded-full bg-rk-success " + (pulse ? "animate-ping" : "")}
            aria-hidden
          />
          실시간 신규 상담
          <span className="text-[13px] text-rk-muted font-normal">· /api/leads · 5초마다 새로고침</span>
        </h3>
        <div className="ml-auto flex gap-2 items-center">
          <span className="text-[13px] text-rk-muted">
            상담 <b className="text-rk-info">{counts.consult}</b> ·
            본사대기 <b className="text-rk-orange-deep">{counts.pending_hq}</b> ·
            회신필요 <b className="text-rk-sale">{counts.respond}</b> ·
            완료 <b className="text-rk-success">{counts.done}</b>
          </span>
          <button type="button" onClick={fetchLeads} className="text-[14px] text-rk-info bg-transparent border-0 cursor-pointer">
            ↻ 새로고침
          </button>
        </div>
      </div>

      {error && <div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded mb-2">⚠ {error}</div>}

      {loading && leads.length === 0 ? (
        <div className="text-[14px] text-rk-muted py-6 text-center">로딩 중…</div>
      ) : leads.length === 0 ? (
        <div className="text-[14px] text-rk-muted py-6 text-center">
          신규 상담이 아직 없습니다. <a href="/consumer" target="_blank" className="text-rk-info underline">소비자 페이지</a>에서 신청해보세요.
        </div>
      ) : (
        <table className="w-full text-[14px] border-collapse">
          <thead>
            <tr>
              {["접수", "고객", "관심상품 · 지역", "상태", "다음 액션"].map((h, i) => (
                <th
                  key={i}
                  className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map(l => {
              const phase = PHASE_OF[l.status];
              const acts = ACTIONS[l.status] ?? [];
              const rowBg =
                phase === "respond" ? "bg-rk-tint-red" :
                phase === "closed" || phase === "done" ? "opacity-70" :
                "hover:bg-rk-soft-2";
              return (
                <tr key={l.id} className={rowBg}>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <b className="rk-num text-rk-ink">{formatTime(l.createdAt)}</b>
                    <br />
                    <small className={l.minutesAgo > 60 ? "text-rk-orange-deep" : l.minutesAgo > 10 ? "text-rk-warn" : "text-rk-muted"}>
                      ⏱ {l.minutesAgo === 0 ? "방금" : `${l.minutesAgo}분 전`}
                    </small>
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <b className="text-rk-ink">{l.customerName}</b>
                    {l.duplicateStatus === "confirmed" && (
                      <span className="ml-1.5 text-[12px] px-1 py-px rounded bg-rk-tint-red text-rk-sale font-medium">중복</span>
                    )}
                    <br />
                    <small className="text-rk-muted font-mono text-[13px]">{l.phoneMasked}</small>
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    {l.productInterest}
                    {l.seller && (
                      <>
                        <br />
                        <small className="text-rk-info text-[12px]">담당 {l.seller.name}</small>
                      </>
                    )}
                    {l.region && (
                      <>
                        <br />
                        <small className="text-rk-muted">{l.region}</small>
                      </>
                    )}
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <span className={"text-[12px] px-1.5 py-px rounded font-medium " + (STATUS_PILL[l.status] ?? "")}>
                      {STATUS_LABEL[l.status] ?? l.status}
                    </span>
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <div className="flex gap-1 flex-wrap">
                      {acts.length === 0 ? (
                        <span className="text-[13px] text-rk-muted">
                          {phase === "pending_hq" ? "⏳ 본사 대기"
                            : phase === "done" ? "✓ 완료"
                            : phase === "closed" ? "— 종료"
                            : "—"}
                        </span>
                      ) : (
                        acts.map(a => (
                          <button
                            key={a.to}
                            type="button"
                            disabled={busyId === l.id}
                            onClick={() => onAction(l, a)}
                            className={
                              "border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50 transition-colors " +
                              TONE_CLASS[a.tone]
                            }
                          >
                            {a.label}
                          </button>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="mt-3 px-3 py-2 bg-rk-tint-green rounded text-[13px] text-rk-success leading-[1.6]">
        ✓ <b>14단계 라이프사이클</b> · 상담희망 → 상담중 → 신청완료(→ 본사 인증대기) → 인증완료(→ 설치대기) → 설치완료 → 정산완료. 모든 변경은 <code className="bg-white/40 px-1 rounded">lead_status_logs</code> 에 감사 기록.
      </div>

      {/* Enrollment 모달 */}
      {enrollmentModal && (
        <EnrollmentFormModal
          leadId={enrollmentModal.leadId}
          prefill={enrollmentModal.prefill}
          existing={enrollmentModal.existing}
          autoAdvance={enrollmentModal.autoAdvance}
          onClose={() => setEnrollmentModal(null)}
          onSaved={() => { setEnrollmentModal(null); fetchLeads(); }}
        />
      )}

      {/* Reason 입력 모달 */}
      {reasonRow && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setReasonRow(null)}>
          <div className="bg-white rounded-lg p-4 w-[360px] shadow-lg" onClick={e => e.stopPropagation()}>
            <h4 className="text-[14px] font-semibold mb-2">메모 입력</h4>
            <textarea
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              rows={3}
              className="w-full border border-rk-line rounded p-2 text-[14px] focus:outline-none focus:border-rk-navy"
              placeholder="사유 또는 회신 내용"
              autoFocus
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button type="button" onClick={() => setReasonRow(null)}
                className="bg-rk-soft hover:bg-rk-line text-rk-ink border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer">
                취소
              </button>
              <button type="button" disabled={busyId === reasonRow.id}
                onClick={() => {
                  const target = leads.find(l => l.id === reasonRow.id);
                  if (target) void changeStatus(target, reasonRow.to, reasonText.trim() || undefined);
                }}
                className="bg-rk-orange hover:bg-rk-orange-deep text-white border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer disabled:opacity-50">
                {busyId === reasonRow.id ? "처리 중…" : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n: number) { return n < 10 ? "0" + n : String(n); }
