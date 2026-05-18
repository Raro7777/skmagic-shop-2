import LiveActivityManager from "@/components/super/LiveActivityManager";

export const metadata = { title: "실시간 접수 띠 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default function LiveActivitiesPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">실시간 접수 띠배너 (LiveActivity)</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        모든 협력점 사이트 hero 위에 자동 롤링 노출. 데모 활동 등록·수정·삭제로 신뢰감 강화.
      </p>
      <LiveActivityManager />
      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        ⓘ 8건 시드 데이터가 기본 등록되어 있습니다. 우선순위(priority) 큰 값이 먼저 노출되며 3.2초 간격으로 자동 순환합니다.
      </div>
    </>
  );
}
