import GlobalBannerManager from "@/components/super/GlobalBannerManager";

export const metadata = { title: "📢 본사 공통 배너 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default function GlobalBannersPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">📢 본사 공통 배너</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        모든 활성 협력점 컨슈머 사이트의 메인 슬라이드에 자동 노출. priority 가산되어 협력점 자기 배너보다 우선.
        <span className="ml-1">CTA 링크에 <code className="font-mono bg-rk-soft px-1 rounded text-[12px]">{"{partnerCode}"}</code> 사용 시 컨슈머 렌더 시 현재 협력점 코드로 자동 치환.</span>
      </p>
      <GlobalBannerManager />
    </>
  );
}
