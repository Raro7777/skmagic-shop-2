import { getEffectivePartner } from "@/lib/effectivePartner";
import { getUtmReport } from "@/lib/utmAnalytics";
import { getGmvChartData } from "@/lib/gmvChart";
import UtmReportCard from "@/components/admin/UtmReportCard";
import GmvChart from "@/components/super/GmvChart";

export const metadata = { title: "마케팅 분석 · 협력점 콘솔" };

export default async function FranchiseAnalyticsPage() {
  const eff = await getEffectivePartner();
  const partnerCode = eff?.partnerId;
  if (!partnerCode) {
    return (
      <div className="bg-rk-tint-orange text-rk-orange-deep p-4 rounded-md text-[14px]">
        협력점 정보를 찾을 수 없습니다.
      </div>
    );
  }
  const [report, chart] = await Promise.all([
    getUtmReport({ partnerId: partnerCode }),
    getGmvChartData({ daysBack: 14, partnerId: partnerCode }),
  ]);

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">분석 · 추이</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        본 협력점의 GMV 14일 추이와 lead 유입 채널·캠페인 효율 (UTM)
      </p>

      <div className="mb-3">
        <GmvChart data={chart} />
      </div>

      <UtmReportCard report={report} scope="협력점" />
    </>
  );
}
