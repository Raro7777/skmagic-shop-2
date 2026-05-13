import { getUtmReport } from "@/lib/utmAnalytics";
import { getHqAnalytics } from "@/lib/hqAnalytics";
import UtmReportCard from "@/components/admin/UtmReportCard";
import HqAnalyticsDashboard from "@/components/admin/HqAnalyticsDashboard";

export const metadata = { title: "마케팅 분석 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default async function SuperAnalyticsPage() {
  const [analytics, utm] = await Promise.all([
    getHqAnalytics(30),
    getUtmReport({}),
  ]);

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">마케팅 채널 분석</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        최근 30일 · 채널별·협력점별 전환율 + 가입 옵션 분포 + UTM 캠페인 효율
      </p>

      <HqAnalyticsDashboard data={analytics} />

      <div className="mt-4">
        <h2 className="text-[16px] font-semibold text-rk-ink mb-2">📡 UTM 캠페인 상세 (최근 3개월)</h2>
        <UtmReportCard report={utm} scope="전체 (HQ)" />
      </div>
    </>
  );
}
