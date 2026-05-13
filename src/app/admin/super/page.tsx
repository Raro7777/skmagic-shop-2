import Link from "next/link";
import GmvChart from "@/components/super/GmvChart";
import { getHqDashboard } from "@/lib/superAdminLive";
import { getGmvChartData } from "@/lib/gmvChart";

export const metadata = { title: "전체 대시보드 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtCompact = (n: number) => {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + "억";
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(1) + "천만";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return n.toString();
};

export default async function SuperDashboard() {
  const [data, chart] = await Promise.all([
    getHqDashboard(),
    getGmvChartData({ daysBack: 14 }),
  ]);

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">전체 운영 대시보드</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        {data.periodMonth} 기준 · 운영 협력점 <b className="text-rk-ink">{data.kpis.activePartners}</b>개 · 정산 <b className="text-rk-ink">{data.totals.settlementsCount}</b>건
      </p>

      <div className="grid grid-cols-5 gap-2.5 mb-4">
        <Kpi primary label="이번 달 정산 GMV" delta={`정산 ${data.totals.settlementsCount}건`} value={fmtCompact(data.kpis.totalSettledGmv)} unit="원" sub="정산 합산 (협력점 송금 전)" />
        <Kpi label="활성 협력점" delta={`+${data.kpis.activePartners}`} value={String(data.kpis.activePartners)} unit="개" sub="DB 활성 상태 기준" />
        <Kpi label="이번 달 신규 lead" delta={`▲ ${data.kpis.newLeadsThisMonth}건`} value={String(data.kpis.newLeadsThisMonth)} unit="건" sub={`평균 ${data.kpis.activePartners ? Math.round(data.kpis.newLeadsThisMonth / data.kpis.activePartners) : 0}건/점`} />
        <Kpi label="본사 수수료 수익" delta="GMV − 협력점 송금" value={fmtCompact(data.kpis.hqRevenue)} unit="원" sub="설치비/사은품 환원분 합계" />
        <Kpi label="회신 대기 (lead)" delta={`${data.kpis.anomalyCount}건`} deltaDown value={String(data.kpis.anomalyCount)} unit="건" sub="인증실패·수정요청·회신상태 합산" />
      </div>

      {/* GMV chart + region grid */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-3 mb-3">
        <GmvChart data={chart} />

        <div className="bg-white border border-rk-line rounded-lg p-4">
          <div className="flex items-center gap-2.5 mb-3 flex-wrap">
            <h3 className="text-[14px] font-semibold">🗺️ 지역별 운영</h3>
            <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-tint-green text-rk-success font-medium ml-1.5">live</span>
            <span className="ml-auto text-[13px] text-rk-muted">{data.regions.length}개 지역</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {data.regions.map(r => (
              <div key={r.name} className="rounded p-2.5 px-3 text-[13px] bg-rk-soft-2 border border-rk-line-2">
                <b className="block font-medium text-[14px] text-rk-ink">{r.name}</b>
                <div className="font-mono font-semibold mt-0.5 text-rk-ink rk-num">₩{fmtCompact(r.settledPayout)}</div>
                <small className="text-rk-muted">{r.partnerCount}개 점 · {r.leadCount}건</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top dealers preview */}
      <div className="bg-white border border-rk-line rounded-lg p-4 mb-3">
        <div className="flex items-center gap-2.5 mb-3 flex-wrap">
          <h3 className="text-[14px] font-semibold">🏆 협력점 순위 <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-tint-green text-rk-success font-medium ml-1">live</span></h3>
          <Link href="/admin/super/partners" className="ml-auto text-[14px] text-rk-info no-underline">전체 협력점 →</Link>
        </div>
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              {["순위", "협력점", "신규 lead", "정산 건", "송금액"].map(h => (
                <th key={h} className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.topDealers.slice(0, 10).map((d, i) => (
              <tr key={d.partnerCode} className="hover:bg-rk-soft-2">
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">
                  <b className={i < 3 ? "text-rk-orange-deep font-bold" : ""}>{i + 1}</b>
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                  <Link href={`/p/${d.partnerCode}`} target="_blank" className="text-rk-ink no-underline">
                    <b className="block font-medium hover:underline">{d.partnerName}</b>
                    <small className="text-rk-faint font-mono text-[12px]">{d.region ?? "—"} · {d.ownerName ?? "—"}</small>
                  </Link>
                </td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">{d.leadCount}</td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">{d.settledCount}</td>
                <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num"><b>₩{fmt(d.settledPayout)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick navigation — lifecycle 큐 4개 */}
      <div className="grid grid-cols-4 gap-2.5">
        <QuickLink href="/admin/super/verify"      icon="🔍" title="인증 처리"      desc="신청 완료된 lead 검토" />
        <QuickLink href="/admin/super/installs"    icon="📦" title="설치 완료 처리" desc="인증 통과 lead 설치 마감" />
        <QuickLink href="/admin/super/settlements" icon="💳" title="이번 달 정산"   desc={`${data.totals.settlementsCount}건 · ₩${fmtCompact(data.totals.settlementsTotal)}`} />
        <QuickLink href="/admin/super/anomalies"   icon="🚨" title="운영 이상감지"  desc="회신 미수신·미응답·매출 급감" />
      </div>
    </>
  );
}

function Kpi({
  primary, label, delta, deltaDown, value, unit, sub,
}: {
  primary?: boolean; label: string; delta: string; deltaDown?: boolean; value: string; unit: string; sub: string;
}) {
  return (
    <div className={"rounded-lg p-3.5 px-4 border " + (primary ? "bg-rk-navy text-white border-rk-navy" : "bg-white border-rk-line")}>
      <div className={"flex justify-between text-[13px] " + (primary ? "text-white/60" : "text-rk-muted")}>
        <span>{label}</span>
        <span className={"font-medium " + (primary ? "text-[#6FE4A8]" : deltaDown ? "text-rk-sale" : "text-rk-success")}>{delta}</span>
      </div>
      <div className={"text-[22px] font-bold mt-1 tracking-[-.02em] rk-num " + (primary ? "text-white" : "text-rk-ink")}>
        {value}<small className={"text-[14px] font-medium ml-0.5 " + (primary ? "text-white/65" : "text-rk-muted")}>{unit}</small>
      </div>
      <div className={"text-[13px] mt-0.5 " + (primary ? "text-white/60" : "text-rk-muted")}>{sub}</div>
    </div>
  );
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href} className="block bg-white border border-rk-line rounded-lg p-3.5 hover:border-rk-navy transition-colors no-underline">
      <div className="text-[20px] mb-1">{icon}</div>
      <b className="text-[13px] text-rk-ink block">{title}</b>
      <small className="text-[13px] text-rk-muted mt-0.5 block">{desc}</small>
    </Link>
  );
}
