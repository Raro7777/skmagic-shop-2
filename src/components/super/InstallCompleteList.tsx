"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export type InstallRow = {
  id: string;
  createdAt: string;
  ageDays: number;
  customerName: string;
  phone: string;
  partnerName: string;
  partnerRegion: string | null;
  productName: string;
  productCode: string | null;
  selectedMode: string | null;
  selectedContractPeriod: number | null;
  expectedBase: number;
  expectedGift: number;
  expectedInstall: number;
  expectedNet: number;
  hasPolicy: boolean;
  hasPartner: boolean;
};

export default function InstallCompleteList({ rows }: { rows: InstallRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [cancelModal, setCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const complete = async (leadId: string) => {
    if (!confirm("설치 완료로 처리합니다. Settlement가 즉시 생성됩니다. 계속?")) return;
    await send(leadId, "install_done");
  };

  const send = async (leadId: string, to: "install_done" | "install_cancel", reason?: string) => {
    setError(null);
    setBusyId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: to,
          memo: to === "install_done" ? "[본사] 설치 완료 처리" : "[본사] 설치 취소",
          ...(reason ? { reason } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "처리 실패");
        return;
      }
      setDone(prev => new Set(prev).add(leadId));
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusyId(null);
      setCancelModal(null);
      setCancelReason("");
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
            {["접수", "고객", "협력점", "상품 · 옵션", "예상 정산", "처리"].map(h => (
              <th key={h} className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isDone = done.has(r.id);
            return (
              <tr key={r.id} className={isDone ? "opacity-50 line-through" : "hover:bg-rk-soft-2"}>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <span className="rk-num text-[13px] text-rk-ink">{r.createdAt}</span>
                  <small className={"block text-[12px] " + (r.ageDays >= 7 ? "text-rk-sale font-medium" : "text-rk-muted")}>
                    {r.ageDays}일 경과{r.ageDays >= 7 && " ⚠"}
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
                  <span className="text-rk-ink">{r.productName}</span>
                  {r.productCode && <small className="block text-rk-faint font-mono text-[12px]">{r.productCode}</small>}
                  {(r.selectedMode || r.selectedContractPeriod) && (
                    <div className="mt-0.5 flex gap-1 flex-wrap">
                      {r.selectedMode && <span className="text-[12px] px-1 py-px rounded bg-rk-tint-blue text-rk-info">{r.selectedMode}</span>}
                      {r.selectedContractPeriod && <span className="text-[12px] px-1 py-px rounded bg-rk-soft-2 text-rk-muted">{r.selectedContractPeriod}개월</span>}
                    </div>
                  )}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-[13px]">
                  {r.hasPartner ? (
                    <>
                      <div className="text-rk-success">+{fmt(r.expectedBase)}</div>
                      {(r.expectedGift + r.expectedInstall) > 0 && (
                        <div className="text-rk-orange-deep">−{fmt(r.expectedGift + r.expectedInstall)}</div>
                      )}
                      <b className="block text-rk-ink mt-0.5">₩{fmt(r.expectedNet)}</b>
                    </>
                  ) : (
                    <span className="text-rk-muted">미배정</span>
                  )}
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  {isDone ? (
                    <span className="text-[13px] text-rk-success font-medium">✓ 처리됨</span>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      <button
                        type="button"
                        disabled={busyId === r.id || pending || !r.hasPolicy}
                        onClick={() => complete(r.id)}
                        className="border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-rk-orange hover:bg-rk-orange-deep text-white"
                        title={!r.hasPolicy ? "HqPolicy가 없어 정산 계산 불가" : undefined}
                      >
                        {busyId === r.id ? "처리 중…" : "📦 설치 완료"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id || pending}
                        onClick={() => { setCancelModal(r.id); setCancelReason(""); }}
                        className="border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50 bg-rk-soft hover:bg-rk-line text-rk-ink"
                      >
                        ❌ 취소
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {cancelModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setCancelModal(null)}>
          <div className="bg-white rounded-lg p-4 w-[400px] shadow-lg" onClick={e => e.stopPropagation()}>
            <h4 className="text-[14px] font-semibold mb-1">설치 취소 사유</h4>
            <p className="text-[13px] text-rk-muted mb-2">취소 시 정산이 발생하지 않습니다. 사유는 협력점에 공유됩니다.</p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              autoFocus
              className="w-full border border-rk-line rounded p-2 text-[14px] focus:outline-none focus:border-rk-navy"
              placeholder="고객 변심 / 설치 일정 불가 / 자격 미달 등"
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button type="button" onClick={() => setCancelModal(null)}
                className="bg-rk-soft hover:bg-rk-line text-rk-ink border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer">
                돌아가기
              </button>
              <button
                type="button"
                disabled={busyId === cancelModal || cancelReason.trim().length < 3}
                onClick={() => send(cancelModal, "install_cancel", cancelReason.trim())}
                className="bg-rk-sale text-white border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer disabled:opacity-50"
              >
                {busyId === cancelModal ? "처리 중…" : "설치 취소"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
