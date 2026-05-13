import { prisma } from "./prisma";

export type UtmBucket = {
  key: string;
  count: number;
  doneCount: number;
  conversionRate: number;
};

export type UtmReport = {
  totalLeads: number;
  doneLeads: number;
  hasUtmLeads: number;
  bySource: UtmBucket[];
  byMedium: UtmBucket[];
  byCampaign: UtmBucket[];
  byDevice: UtmBucket[];
  topReferrers: UtmBucket[];
};

export async function getUtmReport(opts: {
  partnerId?: string | null; // null = HQ-wide
  monthsBack?: number;
} = {}): Promise<UtmReport> {
  const since = new Date(Date.now() - (opts.monthsBack ?? 3) * 30 * 24 * 60 * 60 * 1000);

  const where = {
    createdAt: { gte: since },
    ...(opts.partnerId ? { partnerId: opts.partnerId } : {}),
  };

  const [total, done, hasUtm, sourceGroups, mediumGroups, campaignGroups, deviceGroups, refGroups] =
    await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: { in: ["install_done", "settle_pending", "settle_done"] } } }),
      prisma.lead.count({
        where: { ...where, OR: [{ utmSource: { not: null } }, { utmMedium: { not: null } }, { utmCampaign: { not: null } }] },
      }),
      prisma.lead.groupBy({
        by: ["utmSource"],
        where,
        _count: { _all: true },
        orderBy: { _count: { utmSource: "desc" } },
      }),
      prisma.lead.groupBy({
        by: ["utmMedium"],
        where,
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["utmCampaign"],
        where,
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["deviceType"],
        where,
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["referrer"],
        where,
        _count: { _all: true },
      }),
    ]);

  // For each bucket, also need done count. Easiest: separate aggregations.
  const doneRows = await prisma.lead.groupBy({
    by: ["utmSource", "utmMedium", "utmCampaign", "deviceType"],
    where: { ...where, status: { in: ["install_done", "settle_pending", "settle_done"] } },
    _count: { _all: true },
  });

  const doneByKey = (kind: "source" | "medium" | "campaign" | "device") => {
    const map = new Map<string, number>();
    for (const r of doneRows) {
      const key =
        (kind === "source"   ? r.utmSource :
         kind === "medium"   ? r.utmMedium :
         kind === "campaign" ? r.utmCampaign :
                               r.deviceType) ?? "(none)";
      map.set(key, (map.get(key) ?? 0) + r._count._all);
    }
    return map;
  };

  const buildBuckets = (
    rows: ReadonlyArray<{ _count: { _all: number } } & Record<string, unknown>>,
    keyField: string,
    kind: "source" | "medium" | "campaign" | "device"
  ): UtmBucket[] => {
    const doneMap = doneByKey(kind);
    return rows
      .map(r => {
        const k = (r[keyField] as string | null) ?? "(none)";
        const count = r._count._all;
        const doneCount = doneMap.get(k) ?? 0;
        return {
          key: k,
          count,
          doneCount,
          conversionRate: count > 0 ? doneCount / count : 0,
        };
      })
      .sort((a, b) => b.count - a.count);
  };

  return {
    totalLeads: total,
    doneLeads: done,
    hasUtmLeads: hasUtm,
    bySource:   buildBuckets(sourceGroups,   "utmSource",   "source"),
    byMedium:   buildBuckets(mediumGroups,   "utmMedium",   "medium"),
    byCampaign: buildBuckets(campaignGroups, "utmCampaign", "campaign"),
    byDevice:   buildBuckets(deviceGroups,   "deviceType",  "device"),
    topReferrers: refGroups
      .filter(r => r.referrer)
      .map(r => ({ key: r.referrer!, count: r._count._all, doneCount: 0, conversionRate: 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}
