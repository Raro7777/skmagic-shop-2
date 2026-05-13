import { prisma } from "@/lib/prisma";
import RefundQueueList from "@/components/super/RefundQueueList";

export const metadata = { title: "환수 관리 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default async function RefundsPage() {
  // 진행 중 환수 (refundStatus != null && != refund_done)
  const active = await prisma.settlement.findMany({
    where: { refundStatus: { in: ["refund_pending", "refund_progress"] } },
    orderBy: { refundStartedAt: "asc" },
    include: {
      partner: { select: { partnerName: true } },
      lead:    { select: { customerName: true, productInterest: true } },
    },
  });

  // 최근 완료 (refund_done 최근 10건)
  const done = await prisma.settlement.findMany({
    where: { refundStatus: "refund_done" },
    orderBy: { refundCompletedAt: "desc" },
    take: 10,
    include: {
      partner: { select: { partnerName: true } },
      lead:    { select: { customerName: true } },
    },
  });

  // 환수 시작 가능 후보 (paid + refundStatus null)
  const startableCount = await prisma.settlement.count({
    where: { status: "paid", refundStatus: null },
  });

  const totals = {
    pending: active.filter(s => s.refundStatus === "refund_pending").length,
    progress: active.filter(s => s.refundStatus === "refund_progress").length,
    pendingAmount: active.filter(s => s.refundStatus === "refund_pending").reduce((s, x) => s + (x.refundAmount ?? 0), 0),
    progressAmount: active.filter(s => s.refundStatus === "refund_progress").reduce((s, x) => s + (x.refundAmount ?? 0), 0),
    doneAmount: done.reduce((s, x) => s + (x.refundAmount ?? 0), 0),
  };

  const rows = active.map(s => ({
    id: s.id,
    leadId: s.leadId,
    partnerName: s.partner.partnerName,
    customerName: s.lead?.customerName ?? "—",
    productName: s.productName,
    productCode: s.productCode,
    netPayout: s.netPayout,
    refundStatus: s.refundStatus as "refund_pending" | "refund_progress",
    refundAmount: s.refundAmount ?? 0,
    refundReason: s.refundReason ?? "",
    refundStartedAt: s.refundStartedAt?.toISOString().slice(0, 10) ?? "—",
  }));

  return (
    <>
      <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
        <h1 className="text-[20px] font-bold tracking-[-.02em]">🔄 환수 관리</h1>
        <span className="ml-auto text-[13px] text-rk-muted">본사 전담</span>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        환수예정 <b className="text-rk-orange-deep">{totals.pending}건 ₩{fmt(totals.pendingAmount)}</b> ·
        진행 중 <b className="text-rk-info">{totals.progress}건 ₩{fmt(totals.progressAmount)}</b> ·
        최근 완료 <b className="text-rk-ink">{done.length}건 ₩{fmt(totals.doneAmount)}</b>
        {startableCount > 0 && <> · <a href="/admin/super/settlements" className="text-rk-info no-underline hover:underline">⤴ 송금 완료 정산 {startableCount}건에서 환수 시작 가능</a></>}
      </p>

      {rows.length === 0 ? (
        <div className="bg-white border border-rk-line rounded-lg p-8 text-center text-[14px] text-rk-muted">
          현재 진행 중인 환수가 없습니다.
        </div>
      ) : (
        <RefundQueueList rows={rows} />
      )}

      {done.length > 0 && (
        <section className="bg-white border border-rk-line rounded-lg p-4 mt-3">
          <h3 className="text-[14px] font-semibold mb-2">✅ 최근 환수 완료 ({done.length}건)</h3>
          <table className="w-full text-[14px]">
            <thead>
              <tr>
                {["완료일", "협력점 · 고객", "상품", "환수액", "사유"].map(h => (
                  <th key={h} className="text-left px-2 py-1.5 font-medium text-rk-muted text-[12px] uppercase tracking-[.04em] border-b border-rk-line">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {done.map(s => (
                <tr key={s.id} className="hover:bg-rk-soft-2">
                  <td className="px-2 py-1.5 border-b border-rk-line-2 text-[13px] rk-num text-rk-muted">{s.refundCompletedAt?.toISOString().slice(0, 10) ?? "—"}</td>
                  <td className="px-2 py-1.5 border-b border-rk-line-2">
                    <b className="text-rk-ink">{s.partner.partnerName}</b>
                    <small className="ml-1 text-rk-faint">{s.lead?.customerName ?? "—"}</small>
                  </td>
                  <td className="px-2 py-1.5 border-b border-rk-line-2 text-[13px]">{s.productName}</td>
                  <td className="px-2 py-1.5 border-b border-rk-line-2 rk-num text-rk-orange-deep">−₩{fmt(s.refundAmount ?? 0)}</td>
                  <td className="px-2 py-1.5 border-b border-rk-line-2 text-[13px] text-rk-muted">{s.refundReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px]">
        ⓘ 환수 단계: <b>refund_pending</b>(예정) → <b>refund_progress</b>(진행 중) → <b>refund_done</b>(완료). 완료 후엔 되돌릴 수 없음.
      </div>
    </>
  );
}
