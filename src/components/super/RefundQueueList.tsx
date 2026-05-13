"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const PILL: Record<string, string> = {
  refund_pending:  "bg-rk-tint-orange text-rk-orange-deep",
  refund_progress: "bg-rk-tint-blue text-rk-info",
};
const LABEL: Record<string, string> = {
  refund_pending:  "환수 예정",
  refund_progress: "환수 진행 중",
};

export type RefundRow = {
  id: string;
  leadId: string;
  partnerName: string;
  customerName: string;
  productName: string;
  productCode: string | null;
  netPayout: number;
  refundStatus: "refund_pending" | "refund_progress";
  refundAmount: number;
  refundReason: string;
  refundStartedAt: string;
};

export default function RefundQueueList({ rows }: { rows: RefundRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const action = async (id: string, kind: "advance" | "cancel") => {
    const message = kind === "advance"
      ? "다음 단계로 진행합니다. 계속?"
      : "환수를 취소하고 송금완료 상태로 되돌립니다. 계속?";
    if (!confirm(message)) return;
    setError(null);
    setBusyId(id);
    try {
      const r = await fetch(`/api/settlements/${id}/refund`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: kind }),
      });
      const j = await r.json();
      if (!r.ok) {
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

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      {error && (
        <div className="bg-rk-tint-red text-rk-sale px-3 py-1.5 rounded text-[13px] mb-2">⚠ {error}</div>
      )}

      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            {["시작일", "협력점 · 고객", "상품 · 송금액", "환수 금액", "사유", "단계", "처리"].map(h => (
              <th key={h} className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-rk-soft-2">
              <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-[13px] text-rk-muted">{r.refundStartedAt}</td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                <b className="block text-rk-ink">{r.partnerName}</b>
                <small className="text-rk-faint text-[12px]">{r.customerName}</small>
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                <span className="text-rk-ink">{r.productName}</span>
                <small className="block text-rk-faint text-[12px] rk-num">송금 ₩{fmt(r.netPayout)}</small>
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-rk-orange-deep">−₩{fmt(r.refundAmount)}</td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2 text-[13px] text-rk-muted">{r.refundReason}</td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                <span className={"text-[12px] px-1.5 py-px rounded font-medium " + PILL[r.refundStatus]}>
                  {LABEL[r.refundStatus]}
                </span>
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                <div className="flex gap-1 flex-wrap">
                  <button
                    type="button"
                    disabled={busyId === r.id || pending}
                    onClick={() => action(r.id, "advance")}
                    className="border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50 bg-rk-orange hover:bg-rk-orange-deep text-white"
                  >
                    {busyId === r.id ? "처리…" : r.refundStatus === "refund_pending" ? "▶ 환수 진행" : "✅ 환수 완료"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id || pending}
                    onClick={() => action(r.id, "cancel")}
                    className="border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50 bg-rk-soft hover:bg-rk-line text-rk-ink"
                  >
                    취소
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
