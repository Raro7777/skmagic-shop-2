import { getSellerDashboardBySellerId } from "@/lib/sellerDashboard";
import { getEffectiveSeller } from "@/lib/effectiveSeller";
import SellerLeadActions from "@/components/seller/SellerLeadActions";

export const metadata = { title: "내 lead · 영업자" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const STATUS_PILL: Record<string, string> = {
  new:   "bg-rk-tint-blue text-rk-info",
  going: "bg-rk-tint-orange text-rk-orange-deep",
  done:  "bg-rk-tint-green text-rk-success",
  warn:  "bg-rk-tint-red text-rk-sale",
};

export default async function SellerLeadsPage() {
  const eff = await getEffectiveSeller();
  if (!eff) return null;
  const data = await getSellerDashboardBySellerId(eff.sellerId);
  if (!data) return null;
  const { leads } = data;

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">내 lead 목록</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">총 {leads.length}건 (최근 30건) · 본인이 받은 lead만 처리 가능</p>

      {leads.length === 0 ? (
        <div className="bg-white border border-rk-line rounded-lg p-8 text-center">
          <div className="text-[36px] mb-1.5">📭</div>
          <div className="text-[14px] text-rk-ink font-medium">아직 받은 lead가 없습니다</div>
          <div className="text-[14px] text-rk-muted mt-1">공유 링크를 통해 신청이 들어오면 여기에 표시됩니다.</div>
        </div>
      ) : (
        <table className="w-full bg-white border border-rk-line rounded-lg overflow-hidden text-[14px]">
          <thead className="bg-rk-soft-2">
            <tr>
              {["접수", "고객", "상품 / 옵션", "월 렌탈가", "단계", "다음 할 일"].map((h, i) => (
                <th key={i} className="text-left px-3 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} className="border-t border-rk-line-2">
                <td className="px-3 py-2.5 align-top">
                  <b className="text-[14px] text-rk-ink">{l.receivedAt}</b>
                  <small className={"block font-mono text-[12px] " + (l.receivedNoteTone === "muted" ? "text-rk-muted" : l.receivedNoteTone === "warn" ? "text-rk-sale" : "text-rk-orange-deep")}>
                    {l.receivedNote}
                  </small>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <b className="text-rk-ink">{l.customerName}</b>
                  <small className="text-rk-muted text-[12px] block">{l.customerMeta}</small>
                </td>
                <td className="px-3 py-2.5 align-top">
                  {l.product}
                  {(l.selectedMode || l.selectedContractPeriod || l.rivalCompensationRequested) && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {l.selectedMode && <span className="text-[12px] px-1 py-px rounded bg-rk-tint-blue text-rk-info">{l.selectedMode}</span>}
                      {l.selectedContractPeriod && <span className="text-[12px] px-1 py-px rounded bg-rk-soft-2 text-rk-muted">{l.selectedContractPeriod}개월</span>}
                      {l.rivalCompensationRequested && <span className="text-[12px] px-1 py-px rounded bg-rk-tint-orange text-rk-orange-deep font-medium">🔄 타사보상</span>}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 align-top rk-num">{l.selectedRentalPrice != null ? `₩${fmt(l.selectedRentalPrice)}` : "—"}</td>
                <td className="px-3 py-2.5 align-top">
                  <span className={"text-[12px] px-1.5 py-px rounded font-medium " + STATUS_PILL[l.status]}>{l.statusLabel}</span>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <SellerLeadActions leadId={l.id} status={l.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
