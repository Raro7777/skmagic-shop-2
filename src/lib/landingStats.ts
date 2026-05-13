import { prisma } from "./prisma";

/**
 * 랜딩 페이지용 실시간 통계 — `/preview` 의 데이터 소스.
 * mock 수치 없음. DB 그대로.
 */

const DAY = 24 * 60 * 60 * 1000;

// 광역시도별 좌표 (SVG 200x230 viewbox 기준)
export const PROVINCE_COORDS: Record<string, { x: number; y: number; label: string }> = {
  서울:   { x: 95,  y: 70,  label: "서울"   },
  경기:   { x: 105, y: 76,  label: "경기"   },
  인천:   { x: 78,  y: 75,  label: "인천"   },
  강원:   { x: 130, y: 65,  label: "강원"   },
  충남:   { x: 88,  y: 105, label: "충남"   },
  대전:   { x: 105, y: 115, label: "대전"   },
  충북:   { x: 115, y: 95,  label: "충북"   },
  세종:   { x: 100, y: 108, label: "세종"   },
  전북:   { x: 90,  y: 135, label: "전북"   },
  전남:   { x: 92,  y: 165, label: "전남"   },
  광주:   { x: 88,  y: 152, label: "광주"   },
  경북:   { x: 140, y: 110, label: "경북"   },
  대구:   { x: 138, y: 130, label: "대구"   },
  울산:   { x: 158, y: 140, label: "울산"   },
  부산:   { x: 150, y: 158, label: "부산"   },
  경남:   { x: 125, y: 158, label: "경남"   },
  제주:   { x: 88,  y: 200, label: "제주"   },
};

export type LandingPartnerPoint = {
  partnerCode: string;
  partnerName: string;
  province: string;
  x: number;
  y: number;
  leadsThisMonth: number;
  settledThisMonth: number;
};

export type LandingFeedItem = {
  ts: string;
  partnerName: string;
  productName: string;
  amount: number | null;
  kind: "lead" | "settled";
};

export type LandingStats = {
  partnerCount: number;
  cumulativeGmv: number;       // 누적 정산 합계
  monthlyGmv: number;          // 이번 달
  totalProducts: number;
  totalLeads30d: number;
  conversionRate: number;
  avgCommission: number;       // 정수기 카테고리 평균 baseCommission (ROI 계산기 기본값)
  minRental: number;
  points: LandingPartnerPoint[];
  feed: LandingFeedItem[];
};

function provinceOf(region: string | null | undefined): string {
  if (!region) return "기타";
  const r = region.trim();
  if (r.startsWith("서울")) return "서울";
  if (r.startsWith("경기") || r.includes("성남") || r.includes("분당") || r.includes("부천") || r.includes("수원") || r.includes("안양") || r.includes("고양")) return "경기";
  if (r.startsWith("인천")) return "인천";
  if (r.startsWith("강원")) return "강원";
  if (r.startsWith("충북")) return "충북";
  if (r.startsWith("충남")) return "충남";
  if (r.startsWith("대전")) return "대전";
  if (r.startsWith("세종")) return "세종";
  if (r.startsWith("전북")) return "전북";
  if (r.startsWith("전남")) return "전남";
  if (r.startsWith("광주")) return "광주";
  if (r.startsWith("경북")) return "경북";
  if (r.startsWith("대구")) return "대구";
  if (r.startsWith("울산")) return "울산";
  if (r.startsWith("부산")) return "부산";
  if (r.startsWith("경남")) return "경남";
  if (r.startsWith("제주")) return "제주";
  return "기타";
}

export async function getLandingStats(): Promise<LandingStats> {
  const since30 = new Date(Date.now() - 30 * DAY);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [partners, settlementsAll, settlementsMonth, totalProducts, leads30d, doneLeads30d, hqPolicies, minPriceProduct, recentLeads, recentSettlements] = await Promise.all([
    prisma.partner.findMany({
      where: { status: "active" },
      select: { partnerCode: true, partnerName: true, region: true },
    }),
    prisma.settlement.aggregate({
      where: { status: { notIn: ["cancelled"] } },
      _sum: { netPayout: true },
    }),
    prisma.settlement.aggregate({
      where: { status: { notIn: ["cancelled"] }, createdAt: { gte: monthStart } },
      _sum: { netPayout: true },
    }),
    prisma.product.count({ where: { status: "active" } }),
    prisma.lead.count({ where: { createdAt: { gte: since30 } } }),
    prisma.lead.count({ where: { createdAt: { gte: since30 }, status: { in: ["install_done", "settle_pending", "settle_done"] } } }),
    prisma.hqPolicy.findMany({
      select: { baseCommission: true, product: { select: { category: true } } },
    }),
    prisma.product.findFirst({ where: { status: "active", rentalPrice: { gt: 0 } }, orderBy: { rentalPrice: "asc" } }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since30 } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { partner: { select: { partnerName: true } } },
    }),
    prisma.settlement.findMany({
      where: { paidAt: { not: null } },
      orderBy: { paidAt: "desc" },
      take: 8,
      include: { partner: { select: { partnerName: true } } },
    }),
  ]);

  // 협력점별 이번 달 통계 — 한 번에 묶기
  const monthLeadGroups = await prisma.lead.groupBy({
    by: ["partnerId"],
    where: { createdAt: { gte: monthStart }, partnerId: { not: null } },
    _count: { _all: true },
  });
  const monthSettleGroups = await prisma.settlement.groupBy({
    by: ["partnerId"],
    where: { createdAt: { gte: monthStart }, status: { notIn: ["cancelled"] } },
    _count: { _all: true },
  });
  const leadCountByPartner = new Map(monthLeadGroups.map(g => [g.partnerId, g._count._all]));
  const settleCountByPartner = new Map(monthSettleGroups.map(g => [g.partnerId, g._count._all]));

  const points: LandingPartnerPoint[] = partners
    .map(p => {
      const province = provinceOf(p.region);
      const coord = PROVINCE_COORDS[province];
      if (!coord) return null;
      // 같은 province 안에서 살짝 흩뿌리기 (오버랩 방지) — partnerCode hash 기반
      const h = [...p.partnerCode].reduce((a, c) => a + c.charCodeAt(0), 0);
      const jitterX = ((h % 14) - 7);
      const jitterY = (((h * 7) % 14) - 7);
      return {
        partnerCode: p.partnerCode,
        partnerName: p.partnerName,
        province,
        x: coord.x + jitterX,
        y: coord.y + jitterY,
        leadsThisMonth: leadCountByPartner.get(p.partnerCode) ?? 0,
        settledThisMonth: settleCountByPartner.get(p.partnerCode) ?? 0,
      };
    })
    .filter((p): p is LandingPartnerPoint => p !== null);

  // 정수기 카테고리 평균 baseCommission — ROI 계산기 기본값
  const waterPolicies = hqPolicies.filter(h => h.product.category === "water");
  const avgCommission = waterPolicies.length > 0
    ? Math.round(waterPolicies.reduce((s, h) => s + h.baseCommission, 0) / waterPolicies.length)
    : 45000;

  const feed: LandingFeedItem[] = [
    ...recentLeads.map(l => ({
      ts: l.createdAt.toISOString(),
      partnerName: l.partner?.partnerName ?? "본사 풀",
      productName: l.productInterest,
      amount: l.selectedRentalPrice,
      kind: "lead" as const,
    })),
    ...recentSettlements.map(s => ({
      ts: (s.paidAt ?? s.createdAt).toISOString(),
      partnerName: s.partner.partnerName,
      productName: s.productName,
      amount: s.netPayout,
      kind: "settled" as const,
    })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 12);

  return {
    partnerCount: partners.length,
    cumulativeGmv: settlementsAll._sum.netPayout ?? 0,
    monthlyGmv: settlementsMonth._sum.netPayout ?? 0,
    totalProducts,
    totalLeads30d: leads30d,
    conversionRate: leads30d > 0 ? Math.round((doneLeads30d / leads30d) * 1000) / 10 : 0,
    avgCommission,
    minRental: minPriceProduct?.rentalPrice ?? 15900,
    points,
    feed,
  };
}
