import { prisma } from "@/lib/prisma";
import SettlementsActionTable from "@/components/super/SettlementsActionTable";
import { withVat } from "@/lib/constants/pricing";

export const metadata = { title: "정산 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default async function SettlementsAllPage() {
  const periodMonth = new Date().toISOString().slice(0, 7);
  const [settlements, hqPoolMissing] = await Promise.all([
    prisma.settlement.findMany({
      where: { periodMonth },
      orderBy: { createdAt: "desc" },
      include: {
        partner: { select: { partnerName: true, ownerName: true } },
        lead:    { select: { status: true, customerName: true } },
      },
    }),
    // HQ pool lead 중 install_done 이상까지 도달했으나 Settlement 가 없는 건 — 매출 누락.
    // 본사가 협력점 배정 후 install_done 재처리하거나 수동으로 정산 행 추가 필요.
    prisma.lead.findMany({
      where: {
        partnerId: null,
        status: { in: ["install_done", "settle_pending", "settle_done"] },
        settlement: null,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, customerName: true, productInterest: true, status: true, updatedAt: true },
      take: 10,
    }),
  ]);

  const active = settlements.filter(s => s.status !== "cancelled");
  const total = active.reduce((s, r) => s + r.netPayout, 0);
  const totalCommission = active.reduce((s, r) => s + r.baseCommission, 0);
  const pendingPayoutCount = settlements.filter(s => s.lead?.status === "settle_pending" && s.status !== "cancelled").length;
  const pendingPayoutSum   = settlements.filter(s => s.lead?.status === "settle_pending" && s.status !== "cancelled").reduce((s, r) => s + r.netPayout, 0);

  // 사은품 라벨 조회 (Settlement 에 snapshot 안되어 있어 PartnerPolicy 에서 join — 사후 변경 가능성 있음)
  const productCodes = Array.from(new Set(settlements.map(s => s.productCode).filter((x): x is string => !!x)));
  const products = productCodes.length > 0
    ? await prisma.product.findMany({ where: { productCode: { in: productCodes } }, select: { id: true, productCode: true } })
    : [];
  const productIdByCode = new Map(products.map(p => [p.productCode, p.id]));
  const partnerProductPairs = settlements
    .map(s => s.productCode ? { partnerId: s.partnerId, productId: productIdByCode.get(s.productCode) } : null)
    .filter((x): x is { partnerId: string; productId: string } => !!x && !!x.productId);
  const policies = partnerProductPairs.length > 0
    ? await prisma.partnerPolicy.findMany({
        where: { OR: partnerProductPairs.map(p => ({ partnerId: p.partnerId, productId: p.productId })) },
        select: { partnerId: true, productId: true, giftLabel: true },
      })
    : [];
  const giftLabelByKey = new Map(policies.map(p => [`${p.partnerId}|${p.productId}`, p.giftLabel]));

  const rows = settlements.map(s => {
    const pid = s.productCode ? productIdByCode.get(s.productCode) : null;
    const giftLabel = pid ? (giftLabelByKey.get(`${s.partnerId}|${pid}`) ?? null) : null;
    return {
      id: s.id,
      leadId: s.leadId,
      createdAt: s.createdAt.toISOString().slice(5, 16).replace("T", " "),
      partnerName: s.partner.partnerName,
      ownerName: s.partner.ownerName ?? null,
      customerName: s.lead?.customerName ?? "—",
      leadStatus: s.lead?.status ?? null,
      productName: s.productName,
      productCode: s.productCode,
      baseCommission: s.baseCommission,
      hqMargin: s.hqMargin,
      partnerCommission: s.partnerCommission,
      giftReturned: s.giftReturned,
      giftLabel,
      installReturned: s.installReturned,
      rentalSupportReturned: s.rentalSupportReturned,
      sellerMargin: s.sellerMargin,
      sellerPayout: s.sellerPayout,
      netPayout: s.netPayout,
      status: s.status,
      paidAt: s.paidAt?.toISOString().slice(0, 10) ?? null,
      refundStatus: s.refundStatus ?? null,
      refundAmount: s.refundAmount ?? 0,
    };
  });

  return (
    <>
      <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
        <h1 className="text-[20px] font-bold tracking-[-.02em]">{periodMonth} 정산</h1>
        <a
          href={`/admin/super/settlements/report?month=${periodMonth}`}
          className="ml-auto text-[14px] text-rk-info no-underline hover:underline"
        >
          📄 월별 정산서 (협력점별 청구) →
        </a>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        활성 <b className="text-rk-ink">{active.length}</b>건 ·
        본사 GMV <b className="text-rk-ink rk-num">₩{fmt(totalCommission)}</b> ·
        협력점 송금 공급가 <b className="text-rk-ink rk-num">₩{fmt(total)}</b>
        {" "}<small className="text-rk-faint">(+VAT 청구 ₩{fmt(withVat(total))})</small>
        {pendingPayoutCount > 0 && (
          <>
            {" · "}송금 대기 <b className="text-rk-orange-deep rk-num">{pendingPayoutCount}건 ₩{fmt(pendingPayoutSum)}</b>
            {" "}<small className="text-rk-faint">(+VAT ₩{fmt(withVat(pendingPayoutSum))})</small>
          </>
        )}
      </p>

      <div className="bg-white border border-rk-line rounded-lg p-4">
        {rows.length === 0 ? (
          <div className="text-center py-8 text-[14px] text-rk-muted">
            이번 달 정산 데이터 없음. 본사가 설치완료 처리하면 자동으로 생성됩니다.
          </div>
        ) : (
          <SettlementsActionTable rows={rows} />
        )}
      </div>

      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px]">
        ⓘ 정산대기(settle_pending) lead 의 &quot;💸 송금 완료&quot; 클릭 시 → Lead.status=settle_done · Settlement.status=paid · paidAt 자동 마킹.
      </div>

      {hqPoolMissing.length > 0 && (
        <div className="mt-3 bg-rk-tint-red border border-rk-sale/30 rounded-lg p-3">
          <div className="flex items-baseline justify-between mb-2">
            <b className="text-rk-sale text-[14px]">⚠ HQ pool 정산 누락 — {hqPoolMissing.length}건</b>
            <small className="text-rk-muted text-[12px]">
              partner 미배정 + install_done 이상 도달 → Settlement 미생성
            </small>
          </div>
          <ul className="m-0 pl-0 list-none divide-y divide-rk-line">
            {hqPoolMissing.map(l => (
              <li key={l.id} className="py-1.5 flex items-center gap-2 text-[13px]">
                <span className="font-mono text-[11px] text-rk-faint">{l.id.slice(0, 8)}</span>
                <b className="text-rk-ink">{l.customerName}</b>
                <span className="text-rk-muted">· {l.productInterest}</span>
                <span className="ml-auto text-[12px] text-rk-sale">{l.status}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 mb-0 text-[12px] text-rk-faint">
            ※ 본 lead 들은 매출 누락 위험. <a href="/admin/super/installs" className="text-rk-info underline">설치 큐</a>에서 협력점 배정 후 install_done 재처리하거나, 본사가 직접 정산 행을 추가하세요.
          </p>
        </div>
      )}
    </>
  );
}
