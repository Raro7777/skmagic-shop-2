import type { UtmReport, UtmBucket } from "@/lib/utmAnalytics";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const pct = (n: number) => (n * 100).toFixed(1) + "%";

export default function UtmReportCard({ report, scope }: { report: UtmReport; scope: string }) {
  const conversionRate = report.totalLeads > 0 ? report.doneLeads / report.totalLeads : 0;
  const utmCoverage = report.totalLeads > 0 ? report.hasUtmLeads / report.totalLeads : 0;

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">
          📊 마케팅 채널 분석 ({scope})
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rk-tint-green text-rk-success font-medium ml-1.5">live</span>
        </h3>
        <span className="ml-auto text-[11px] text-rk-muted">최근 3개월</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <SummaryCell label="누적 lead" value={fmt(report.totalLeads)} unit="건" />
        <SummaryCell label="설치 완료 전환" value={pct(conversionRate)} unit={`${fmt(report.doneLeads)}건`} highlight />
        <SummaryCell label="UTM 캡처율" value={pct(utmCoverage)} unit={`${fmt(report.hasUtmLeads)}건`} />
      </div>

      {report.totalLeads === 0 ? (
        <div className="text-center py-6 text-[12px] text-rk-muted">
          표시할 lead 데이터가 없습니다. 협력점 사이트를 광고하면 UTM 데이터가 자동으로 쌓입니다.
        </div>
      ) : (
        <>
          {/* Source breakdown */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <BucketTable title="채널 소스 (utm_source)" buckets={report.bySource} totalLeads={report.totalLeads} />
            <BucketTable title="매체 (utm_medium)" buckets={report.byMedium} totalLeads={report.totalLeads} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BucketTable title="캠페인 (utm_campaign)" buckets={report.byCampaign} totalLeads={report.totalLeads} />
            <BucketTable title="기기 분포" buckets={report.byDevice} totalLeads={report.totalLeads} />
          </div>

          {report.topReferrers.length > 0 && (
            <div className="mt-3">
              <h4 className="text-[12px] font-semibold text-rk-ink mb-1.5">유입 referrer (UTM 없는 경우)</h4>
              <div className="flex flex-col gap-1">
                {report.topReferrers.slice(0, 5).map(r => (
                  <div key={r.key} className="flex items-center gap-2 text-[11px] py-1 px-2 bg-rk-soft-2 rounded">
                    <span className="font-mono truncate flex-1">{shortenUrl(r.key)}</span>
                    <span className="text-rk-muted shrink-0">{r.count}건</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-3 px-3 py-2 bg-rk-tint-blue rounded text-[11px] text-rk-info leading-[1.6]">
        ⓘ URL 끝에 <code className="font-mono bg-white/40 px-1 rounded">?utm_source=instagram&utm_medium=profile&utm_campaign=may_promo</code> 같이 붙여서 광고 채널을 추적합니다.
        UtmTracker 컴포넌트가 자동으로 sessionStorage에 저장하고 상담 신청 시 함께 전송합니다.
      </div>
    </div>
  );
}

function SummaryCell({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={"rounded-md p-3 " + (highlight ? "bg-rk-navy text-white" : "bg-rk-soft-2 border border-rk-line-2")}>
      <div className={"text-[10px] " + (highlight ? "text-white/70" : "text-rk-muted")}>{label}</div>
      <div className={"text-[18px] font-bold mt-0.5 rk-num " + (highlight ? "text-[#FFB374]" : "text-rk-ink")}>
        {value}
      </div>
      <div className={"text-[10px] mt-0.5 " + (highlight ? "text-white/60" : "text-rk-muted")}>{unit}</div>
    </div>
  );
}

function BucketTable({ title, buckets, totalLeads }: { title: string; buckets: UtmBucket[]; totalLeads: number }) {
  const top = buckets.filter(b => b.count > 0).slice(0, 6);
  return (
    <div className="bg-rk-soft-2 border border-rk-line-2 rounded-md p-3">
      <h4 className="text-[12px] font-semibold text-rk-ink mb-2">{title}</h4>
      {top.length === 0 ? (
        <div className="text-[11px] text-rk-muted text-center py-3">데이터 없음</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {top.map(b => {
            const sharePct = totalLeads > 0 ? (b.count / totalLeads) * 100 : 0;
            return (
              <div key={b.key} className="text-[11px]">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <b className="text-rk-ink truncate flex-1">{b.key === "(none)" ? "직접 유입 (UTM 없음)" : b.key}</b>
                  <span className="rk-num text-rk-muted shrink-0">{b.count}건</span>
                  {b.doneCount > 0 && (
                    <span className="text-rk-success rk-num shrink-0 text-[10px]">→ {b.doneCount}완료</span>
                  )}
                </div>
                <div className="bg-rk-line-2 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-rk-navy h-full"
                    style={{ width: Math.max(2, sharePct) + "%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname === "/" ? "" : u.pathname.slice(0, 30));
  } catch {
    return url.slice(0, 50);
  }
}
