import { prisma } from "@/lib/prisma";
import SettlementsActionTable from "@/components/super/SettlementsActionTable";

export const metadata = { title: "정산 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default async function SettlementsAllPage() {
  const periodMonth = new Date().toISOString().slice(0, 7);
  const settlements = await prisma.settlement.findMany({
    where: { periodMonth },
    orderBy: { createdAt: "desc" },
    include: {
      partner: { select: { partnerName: true, ownerName: true } },
      lead:    { select: { status: true, customerName: true } },
    },
  });

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
        협력점 송금 합계 <b className="text-rk-ink rk-num">₩{fmt(total)}</b>
        {pendingPayoutCount > 0 && (
          <> · 송금 대기 <b className="text-rk-orange-deep rk-num">{pendingPayoutCount}건 ₩{fmt(pendingPayoutSum)}</b></>
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
    </>
  );
}
