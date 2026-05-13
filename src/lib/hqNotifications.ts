import { prisma } from "./prisma";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type HqNotificationItem = {
  kind: "crawl_pending" | "crawl_failed" | "approval_pending" | "duplicate_pending";
  severity: "info" | "warn" | "critical";
  label: string;
  count: number;
  detail: string;
  href: string;
};

export type HqNotifications = {
  totalCount: number;
  items: HqNotificationItem[];
  recentCrawl: {
    runId: string;
    sourceName: string;
    finishedAtLabel: string;
    status: string;
    newCount: number;
    updatedCount: number;
    unchangedCount: number;
    errorMessage: string | null;
  } | null;
};

const fmtDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
function pad(n: number) { return n < 10 ? "0" + n : String(n); }

export async function getHqNotifications(): Promise<HqNotifications> {
  const since = new Date(Date.now() - 7 * DAY);

  const [pendingCrawl, failedCrawlRuns, pendingApprovals, possibleDuplicates, recentRun] = await Promise.all([
    prisma.crawledProduct.count({ where: { approvalStatus: "pending" } }),
    prisma.crawlRun.count({
      where: { status: "failed", startedAt: { gte: since } },
    }),
    prisma.approvalRequest.count({ where: { status: "pending" } }),
    prisma.lead.count({ where: { duplicateStatus: "possible" } }),
    prisma.crawlRun.findFirst({
      where: { finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      include: { source: { select: { name: true } } },
    }),
  ]);

  const items: HqNotificationItem[] = [];

  if (pendingCrawl > 0) {
    items.push({
      kind: "crawl_pending",
      severity: "info",
      label: "🔄 크롤 검토 대기",
      count: pendingCrawl,
      detail: "본사몰에서 신규/변경된 상품 — 본사 검토 후 마스터에 반영",
      href: "/admin/super/crawl/queue",
    });
  }

  if (failedCrawlRuns > 0) {
    items.push({
      kind: "crawl_failed",
      severity: "critical",
      label: "🚨 크롤 실패",
      count: failedCrawlRuns,
      detail: "최근 7일 크롤 실패 — 본사몰 변경 또는 네트워크 점검 필요",
      href: "/admin/super/crawl",
    });
  }

  if (pendingApprovals > 0) {
    items.push({
      kind: "approval_pending",
      severity: "warn",
      label: "✅ 승인 대기",
      count: pendingApprovals,
      detail: "협력점 환원 한도 초과 / 신규 가입 등 본사 승인 필요",
      href: "/admin/super/approvals",
    });
  }

  if (possibleDuplicates > 0) {
    items.push({
      kind: "duplicate_pending",
      severity: "info",
      label: "🔁 중복 lead 판정",
      count: possibleDuplicates,
      detail: "2/3순위 중복 후보 — 본사 판정 필요 (룰북 9.1)",
      href: "/admin/super/duplicates",
    });
  }

  // severity rank
  const SEV_RANK = { critical: 0, warn: 1, info: 2 };
  items.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.count - a.count);

  return {
    totalCount: items.reduce((s, i) => s + i.count, 0),
    items,
    recentCrawl: recentRun ? {
      runId: recentRun.id,
      sourceName: recentRun.source.name,
      finishedAtLabel: recentRun.finishedAt ? fmtDate(recentRun.finishedAt) : "—",
      status: recentRun.status,
      newCount: recentRun.newCount,
      updatedCount: recentRun.updatedCount,
      unchangedCount: recentRun.unchangedCount,
      errorMessage: recentRun.errorMessage,
    } : null,
  };
}
