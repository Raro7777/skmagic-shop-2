import BannerTemplateManager from "@/components/super/BannerTemplateManager";

export const metadata = { title: "배너 템플릿 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default function BannerTemplatesPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">본사 표준 배너 템플릿</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        시즌·이벤트별 표준 디자인 등록 · 협력점이 콘솔에서 가져와서 자기 사이트에 적용
      </p>
      <BannerTemplateManager />
      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        ⓘ 협력점이 가져갈 때 색상·텍스트·기간은 협력점 측에서 자유롭게 조정합니다.
        본사 권장 디자인을 보존하고 싶다면 status=archived 처리해 새 협력점에 노출되지 않게 할 수 있습니다.
      </div>
    </>
  );
}
