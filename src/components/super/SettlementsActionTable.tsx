"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const SETTLE_LABEL: Record<string, string> = {
  pending: "검증 대기", confirmed: "검증 완료", paid: "송금 완료", cancelled: "취소", disputed: "이의 신청",
};
const SETTLE_PILL: Record<string, string> = {
  pending: "bg-rk-tint-blue text-rk-info",
  confirmed: "bg-rk-tint-green text-rk-success",
  paid: "bg-rk-tint-green text-rk-success",
  cancelled: "bg-rk-tint-gray text-rk-muted",
  disputed: "bg-rk-tint-orange text-rk-orange-deep",
};

export type SettleRow = {
  id: string;
  leadId: string;
  createdAt: string;
  partnerName: string;
  ownerName: string | null;
  customerName: string;
  leadStatus: string | null;
  productName: string;
  productCode: string | null;
  baseCommission: number;
  giftReturned: number;
  installReturned: number;
  rentalSupportReturned: number;
  netPayout: number;
  status: string;
  paidAt: string | null;
  refundStatus: string | null;
  refundAmount: number;
};

export default function SettlementsActionTable({ rows }: { rows: SettleRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState<SettleRow | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const markPaid = async (row: SettleRow) => {
    if (!confirm(`${row.partnerName} · ${row.customerName} 송금 완료로 처리합니다. 계속?`)) return;
    setError(null);
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/leads/${row.leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "settle_done", memo: "[본사] 송금 완료" }),
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
      setBusyId(null);
    }
  };

  const startRefund = async () => {
    if (!refundModal) return;
    const amount = parseInt(refundAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) { setError("환수 금액은 양수여야 합니다."); return; }
    if (refundReason.trim().length < 3) { setError("환수 사유를 3자 이상 입력하세요."); return; }
    setError(null);
    setBusyId(refundModal.id);
    try {
      const res = await fetch(`/api/settlements/${refundModal.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason: refundReason.trim() }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "환수 시작 실패");
        return;
      }
      setRefundModal(null);
      setRefundAmount("");
      setRefundReason("");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {error && (
        <div className="bg-rk-tint-red text-rk-sale px-3 py-1.5 rounded text-[13px] mb-2">⚠ {error}</div>
      )}
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            {["생성", "협력점 · 고객", "상품", "본사 수수료", "환원", "송금액", "상태", "송금 처리"].map(h => (
              <th key={h} className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(s => {
            const canMarkPaid = s.leadStatus === "settle_pending" && s.status !== "cancelled" && s.status !== "paid";
            return (
              <tr key={s.id} className={s.status === "cancelled" ? "opacity-50 line-through" : "hover:bg-rk-soft-2"}>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-[12px] text-rk-muted">
                  {s.createdAt}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <b className="block text-rk-ink">{s.partnerName}</b>
                  <small className="text-rk-faint font-mono text-[12px]">{s.customerName} {s.ownerName ? `· ${s.ownerName}` : ""}</small>
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  {s.productName}
                  {s.productCode && <small className="block text-rk-faint font-mono text-[12px]">{s.productCode}</small>}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-rk-success">+{fmt(s.baseCommission)}</td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">
                  {s.giftReturned + s.installReturned + s.rentalSupportReturned > 0
                    ? (
                      <div>
                        <span className="text-rk-orange-deep">−{fmt(s.giftReturned + s.installReturned + s.rentalSupportReturned)}</span>
                        {s.rentalSupportReturned > 0 && (
                          <small className="block text-[10px] text-rk-orange-deep">렌탈지원 −{fmt(s.rentalSupportReturned)}</small>
                        )}
                      </div>
                    )
                    : <span className="text-rk-muted">—</span>}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num"><b>₩{fmt(s.netPayout)}</b></td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <span className={"text-[12px] px-1.5 py-px rounded font-medium " + (SETTLE_PILL[s.status] ?? SETTLE_PILL.pending)}>
                    {SETTLE_LABEL[s.status] ?? s.status}
                  </span>
                  {s.paidAt && <small className="block text-[12px] text-rk-faint mt-px">{s.paidAt}</small>}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  {canMarkPaid ? (
                    <button
                      type="button"
                      disabled={busyId === s.id || pending}
                      onClick={() => markPaid(s)}
                      className="border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50 bg-rk-orange hover:bg-rk-orange-deep text-white"
                    >
                      {busyId === s.id ? "처리…" : "💸 송금 완료"}
                    </button>
                  ) : s.status === "paid" && !s.refundStatus ? (
                    <div className="flex gap-1 flex-wrap">
                      <span className="text-[12px] text-rk-success">✓ 송금 완료</span>
                      <button
                        type="button"
                        disabled={busyId === s.id || pending}
                        onClick={() => { setRefundModal(s); setRefundAmount(String(s.netPayout + s.rentalSupportReturned)); setRefundReason(""); }}
                        className="border-0 px-2 py-px rounded text-[12px] cursor-pointer font-medium bg-rk-tint-orange text-rk-orange-deep hover:bg-rk-orange hover:text-white"
                      >
                        🔄 환수
                      </button>
                    </div>
                  ) : s.refundStatus ? (
                    <span className="text-[12px] text-rk-orange-deep font-medium">
                      🔄 {s.refundStatus === "refund_pending" ? "환수 예정" : s.refundStatus === "refund_progress" ? "환수 진행" : "환수 완료"}
                    </span>
                  ) : s.status === "cancelled" ? (
                    <span className="text-[12px] text-rk-muted">— 취소</span>
                  ) : (
                    <span className="text-[12px] text-rk-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {refundModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setRefundModal(null)}>
          <div className="bg-white rounded-lg p-4 w-[420px] shadow-lg" onClick={e => e.stopPropagation()}>
            <h4 className="text-[14px] font-semibold mb-1">환수 시작</h4>
            <p className="text-[13px] text-rk-muted mb-2">
              {refundModal.partnerName} · {refundModal.customerName} · {refundModal.productName}
              <br />
              송금액 ₩{fmt(refundModal.netPayout)}
              {refundModal.rentalSupportReturned > 0 && (
                <> + 본사 캐시백(렌탈지원) ₩{fmt(refundModal.rentalSupportReturned)} = <b>전체 ₩{fmt(refundModal.netPayout + refundModal.rentalSupportReturned)}</b></>
              )}
            </p>
            <label className="block text-[13px] text-rk-muted mb-1">
              환수 금액 (기본: 송금액 + 렌탈지원금 전체)
            </label>
            <input
              type="number"
              min="1"
              max={refundModal.netPayout + refundModal.rentalSupportReturned}
              value={refundAmount}
              onChange={e => setRefundAmount(e.target.value)}
              className="w-full border border-rk-line rounded p-2 text-[14px] focus:outline-none focus:border-rk-navy mb-2"
            />
            <label className="block text-[13px] text-rk-muted mb-1">환수 사유</label>
            <textarea
              value={refundReason}
              onChange={e => setRefundReason(e.target.value)}
              rows={3}
              autoFocus
              className="w-full border border-rk-line rounded p-2 text-[14px] focus:outline-none focus:border-rk-navy"
              placeholder="해약 / 미설치 / 분쟁 / 계약 위반 등"
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button type="button" onClick={() => setRefundModal(null)}
                className="bg-rk-soft hover:bg-rk-line text-rk-ink border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer">
                취소
              </button>
              <button type="button" disabled={busyId === refundModal.id} onClick={startRefund}
                className="bg-rk-sale text-white border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer disabled:opacity-50">
                {busyId === refundModal.id ? "처리 중…" : "🔄 환수 시작"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
