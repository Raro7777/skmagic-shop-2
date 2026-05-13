import { prisma } from "./prisma";

export type DailyBucket = {
  date: string;        // "2026-05-09"
  weekday: string;     // "월"
  isToday: boolean;
  gmv: number;         // sum of baseCommission
  hqRevenue: number;   // sum of (baseCommission - netPayout)
  partnerPayout: number; // sum of netPayout
  leadCount: number;
  doneCount: number;
};

export type GmvChartData = {
  days: DailyBucket[];
  totals: {
    gmv: number;
    hqRevenue: number;
    partnerPayout: number;
    leadCount: number;
    doneCount: number;
  };
  maxGmv: number;
  peak: { date: string; gmv: number } | null;
  averageDailyGmv: number;
  scope: "all" | "partner";
  partnerId?: string;
};

export async function getGmvChartData(opts: {
  daysBack?: number;
  partnerId?: string;
} = {}): Promise<GmvChartData> {
  const daysBack = opts.daysBack ?? 14;
  const since = new Date();
  since.setDate(since.getDate() - (daysBack - 1));
  since.setHours(0, 0, 0, 0);

  const where = {
    createdAt: { gte: since },
    ...(opts.partnerId ? { partnerId: opts.partnerId } : {}),
  };

  const [settlements, leads] = await Promise.all([
    prisma.settlement.findMany({
      where: { ...where, status: { not: "cancelled" } },
      select: { createdAt: true, baseCommission: true, netPayout: true },
    }),
    prisma.lead.findMany({
      where,
      select: { createdAt: true, status: true },
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  const dayMap = new Map<string, DailyBucket>();
  for (let i = 0; i < daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (daysBack - 1 - i));
    d.setHours(0, 0, 0, 0);
    const dateKey = d.toISOString().slice(0, 10);
    dayMap.set(dateKey, {
      date: dateKey,
      weekday: WEEKDAYS[d.getDay()],
      isToday: dateKey === todayKey,
      gmv: 0,
      hqRevenue: 0,
      partnerPayout: 0,
      leadCount: 0,
      doneCount: 0,
    });
  }

  for (const s of settlements) {
    const key = toDateKey(s.createdAt);
    const b = dayMap.get(key);
    if (b) {
      b.gmv += s.baseCommission;
      b.partnerPayout += s.netPayout;
      b.hqRevenue += s.baseCommission - s.netPayout;
    }
  }
  for (const l of leads) {
    const key = toDateKey(l.createdAt);
    const b = dayMap.get(key);
    if (b) {
      b.leadCount += 1;
      if (l.status === "install_done" || l.status === "settle_pending" || l.status === "settle_done") b.doneCount += 1;
    }
  }

  const days = Array.from(dayMap.values());
  const maxGmv = Math.max(...days.map(d => d.gmv), 0);
  const totals = days.reduce(
    (acc, d) => ({
      gmv: acc.gmv + d.gmv,
      hqRevenue: acc.hqRevenue + d.hqRevenue,
      partnerPayout: acc.partnerPayout + d.partnerPayout,
      leadCount: acc.leadCount + d.leadCount,
      doneCount: acc.doneCount + d.doneCount,
    }),
    { gmv: 0, hqRevenue: 0, partnerPayout: 0, leadCount: 0, doneCount: 0 }
  );
  const peakDay = days.reduce((a, b) => (b.gmv > a.gmv ? b : a), days[0]);
  const peak = peakDay && peakDay.gmv > 0 ? { date: peakDay.date, gmv: peakDay.gmv } : null;
  const averageDailyGmv = totals.gmv / daysBack;

  return {
    days,
    totals,
    maxGmv,
    peak,
    averageDailyGmv,
    scope: opts.partnerId ? "partner" : "all",
    partnerId: opts.partnerId,
  };
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
