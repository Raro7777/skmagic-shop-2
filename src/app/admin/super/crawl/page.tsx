import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CrawlSourcesPanel from "@/components/super/CrawlSourcesPanel";

export const metadata = { title: "상품 크롤링 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmt = (d: Date | null) => {
  if (!d) return null;
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function pad(n: number) { return n < 10 ? "0" + n : String(n); }

export default async function CrawlPage() {
  const [sources, runs, pendingByCounts] = await Promise.all([
    prisma.crawlSource.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.crawlRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 12,
      include: { source: { select: { name: true } } },
    }),
    prisma.crawledProduct.groupBy({
      by: ["sourceId"],
      where: { approvalStatus: "pending" },
      _count: { _all: true },
    }),
  ]);

  const pendingMap = new Map(pendingByCounts.map(p => [p.sourceId, p._count._all]));
  const totalPending = pendingByCounts.reduce((s, p) => s + p._count._all, 0);

  const sourceRows = sources.map(s => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    baseUrl: s.baseUrl,
    status: s.status,
    intervalMin: s.intervalMin,
    lastCrawledAt: fmt(s.lastCrawledAt),
    pendingCount: pendingMap.get(s.id) ?? 0,
  }));

  const runRows = runs.map(r => ({
    id: r.id,
    sourceName: r.source.name,
    startedLabel: fmt(r.startedAt) ?? "",
    finishedLabel: fmt(r.finishedAt),
    status: r.status,
    itemCount: r.itemCount,
    newCount: r.newCount,
    updatedCount: r.updatedCount,
    unchangedCount: r.unchangedCount,
    errorMessage: r.errorMessage,
  }));

  return (
    <>
      <div className="flex items-center justify-between mb-0.5">
        <h1 className="text-[20px] font-bold tracking-[-.02em]">상품 크롤링</h1>
        <Link
          href="/admin/super/crawl/queue"
          className="bg-rk-navy hover:bg-rk-navy-deep text-white px-3 py-1.5 rounded text-[14px] font-medium no-underline"
        >
          🗂 검토 대기 큐
          {totalPending > 0 && (
            <span className="ml-2 bg-rk-orange text-white px-1.5 py-px rounded-full text-[12px] font-bold">
              {totalPending}
            </span>
          )}
        </Link>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        본사 공식몰에서 상품 정보를 수집한 뒤, 검토 큐를 통과한 항목만 상품 마스터에 반영됩니다 (룰북 19).
      </p>

      <CrawlSourcesPanel sources={sourceRows} recentRuns={runRows} />

      <div className="mt-4 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        ⓘ 데모 어댑터는 robots.txt와 요청 빈도(룰북 19.8)를 시뮬레이션합니다. 실제 운영 시에는 서버측 fetch + cheerio로 구현하며, 동일 도메인에 800ms 이상 간격을 둡니다.<br />
        ⓘ 크롤된 데이터는 즉시 반영되지 않고 <Link href="/admin/super/crawl/queue" className="underline">검토 큐</Link>에 적재됩니다 (룰북 19.5).
      </div>
    </>
  );
}
