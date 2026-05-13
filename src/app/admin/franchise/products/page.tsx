import { getEffectivePartner } from "@/lib/effectivePartner";
import { prisma } from "@/lib/prisma";
import ProductTable from "@/components/franchise/ProductTable";
import BannerSchedule from "@/components/franchise/BannerSchedule";
import PolicyEditor from "@/components/franchise/PolicyEditor";
import ProductDisplayEditor from "@/components/franchise/ProductDisplayEditor";
import LockedFeature from "@/components/franchise/LockedFeature";
import { canUseFeature, TIER_LABEL, TIER_PILL, type Tier } from "@/lib/tier";

export const metadata = { title: "상품 진열 · 정책 · 협력점 콘솔" };
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const eff = await getEffectivePartner();
  const partnerCode = eff?.partnerId;
  const partner = partnerCode
    ? await prisma.partner.findUnique({
        where: { partnerCode },
        select: { tier: true, partnerName: true },
      })
    : null;
  const tier = (partner?.tier ?? "basic") as Tier;

  return (
    <>
      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
        <h1 className="text-[20px] font-bold tracking-[-.02em]">상품 진열 · 정책</h1>
        <span className={"text-[12px] px-1.5 py-0.5 rounded font-medium " + TIER_PILL[tier]}>
          {TIER_LABEL[tier]} 패키지
        </span>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        진열 순서 · 본사 정책 기반 사은품/설치비 환원 · 이벤트 배너
      </p>

      <ProductTable />

      <div className="mb-3">
        {canUseFeature(tier, "display_drag")
          ? <ProductDisplayEditor />
          : <LockedFeature feature="display_drag" currentTier={tier} />}
      </div>

      <div className="mb-3">
        <PolicyEditor />
      </div>

      <div className="mb-3">
        {canUseFeature(tier, "banner_schedule")
          ? <BannerSchedule />
          : <LockedFeature feature="banner_schedule" currentTier={tier} />}
      </div>
    </>
  );
}
