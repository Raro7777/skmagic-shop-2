import { prisma } from "./prisma";

export type HqDashboard = {
  periodMonth: string;
  kpis: {
    totalSettledGmv: number;     // 이번 달 정산 합산 (본사 매출)
    hqRevenue: number;           // 협력점 송금 후 본사 몫 (= sum baseCommission - netPayout)
    activePartners: number;
    newLeadsThisMonth: number;
    anomalyCount: number;        // status === warn
  };
  topDealers: Array<{
    partnerCode: string;
    partnerName: string;
    ownerName: string | null;
    region: string | null;
    leadCount: number;
    settledCount: number;
    settledPayout: number;
  }>;
  recentSettlements: Array<{
    id: string;
    partnerName: string;
    partnerOwner: string | null;
    productName: string;
    productCode: string | null;
    baseCommission: number;
    giftReturned: number;
    installReturned: number;
    netPayout: number;
    status: string;
    createdAt: string;
  }>;
  regions: Array<{
    name: string;
    partnerCount: number;
    settledPayout: number;
    leadCount: number;
  }>;
  totals: {
    settlementsCount: number;
    settlementsTotal: number;
  };
};

export async function getHqDashboard(): Promise<HqDashboard> {
  const now = new Date();
  const periodMonth = now.toISOString().slice(0, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ----- Parallel base queries -----
  const [
    activePartners,
    newLeadsThisMonth,
    anomalyCount,
    settlementAgg,
    leadGroups,
    settlementGroups,
    partners,
    recentSettlements,
  ] = await Promise.all([
    prisma.partner.count({ where: { status: "active" } }),
    prisma.lead.count({ where: { createdAt: { gte: monthStart } } }),
    // 운영 이상감지 KPI = 인증실패 + 수정요청 + 회신상태 합산 (영업점 회신 대기)
    prisma.lead.count({ where: { status: { in: ["verify_failed", "verify_revise", "revise_resubmit"] } } }),
    prisma.settlement.aggregate({
      where: { periodMonth, status: { not: "cancelled" } },
      _sum: { netPayout: true, baseCommission: true },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["partnerId"],
      where: { partnerId: { not: null }, createdAt: { gte: monthStart } },
      _count: { _all: true },
    }),
    prisma.settlement.groupBy({
      by: ["partnerId"],
      where: { periodMonth, status: { not: "cancelled" } },
      _sum: { netPayout: true },
      _count: { _all: true },
    }),
    prisma.partner.findMany({
      where: { status: "active" },
      select: { partnerCode: true, partnerName: true, region: true, ownerName: true },
    }),
    prisma.settlement.findMany({
      where: { periodMonth },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { partner: true },
    }),
  ]);

  const partnerByCode = new Map(partners.map(p => [p.partnerCode, p]));
  const leadCountByPartner = new Map<string, number>(
    leadGroups.map(g => [g.partnerId!, g._count._all])
  );
  const settlementByPartner = new Map<string, { count: number; payout: number }>(
    settlementGroups.map(g => [
      g.partnerId,
      { count: g._count._all, payout: g._sum.netPayout ?? 0 },
    ])
  );

  // ----- Top dealers -----
  const topDealers = partners
    .map(p => {
      const settled = settlementByPartner.get(p.partnerCode) ?? { count: 0, payout: 0 };
      return {
        partnerCode: p.partnerCode,
        partnerName: p.partnerName,
        ownerName: p.ownerName,
        region: p.region,
        leadCount: leadCountByPartner.get(p.partnerCode) ?? 0,
        settledCount: settled.count,
        settledPayout: settled.payout,
      };
    })
    .sort((a, b) => (b.settledPayout - a.settledPayout) || (b.leadCount - a.leadCount));

  // ----- Region grouping -----
  const regionMap = new Map<string, { partnerCount: number; settledPayout: number; leadCount: number }>();
  for (const p of partners) {
    const key = p.region ?? "기타";
    const settled = settlementByPartner.get(p.partnerCode);
    const leads = leadCountByPartner.get(p.partnerCode) ?? 0;
    const cur = regionMap.get(key) ?? { partnerCount: 0, settledPayout: 0, leadCount: 0 };
    regionMap.set(key, {
      partnerCount: cur.partnerCount + 1,
      settledPayout: cur.settledPayout + (settled?.payout ?? 0),
      leadCount: cur.leadCount + leads,
    });
  }
  const regions = Array.from(regionMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.settledPayout - a.settledPayout);

  // ----- Settlements table -----
  const settledRows = recentSettlements.map(s => ({
    id: s.id,
    partnerName: s.partner.partnerName,
    partnerOwner: s.partner.ownerName,
    productName: s.productName,
    productCode: s.productCode,
    baseCommission: s.baseCommission,
    giftReturned: s.giftReturned,
    installReturned: s.installReturned,
    netPayout: s.netPayout,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  }));

  const totalSettledGmv = settlementAgg._sum.baseCommission ?? 0;
  const settledTotal = settlementAgg._sum.netPayout ?? 0;
  const hqRevenue = totalSettledGmv - settledTotal;

  return {
    periodMonth,
    kpis: {
      totalSettledGmv,
      hqRevenue,
      activePartners,
      newLeadsThisMonth,
      anomalyCount,
    },
    topDealers,
    recentSettlements: settledRows,
    regions,
    totals: {
      settlementsCount: settlementAgg._count,
      settlementsTotal: settledTotal,
    },
  };
}
