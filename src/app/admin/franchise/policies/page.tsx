import Link from "next/link";
import { getEffectivePartner } from "@/lib/effectivePartner";
import { prisma } from "@/lib/prisma";
import PolicyEditor from "@/components/franchise/PolicyEditor";
import { TIER_LABEL, TIER_PILL, type Tier } from "@/lib/tier";

export const metadata = { title: "사은품 · 설치 정책 · 협력점 콘솔" };
export const dynamic = "force-dynamic";

export default async function FranchisePoliciesPage() {
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
        <h1 className="text-[20px] font-bold tracking-[-.02em]">사은품 · 설치 정책</h1>
        <span className={"text-[12px] px-1.5 py-0.5 rounded font-medium " + TIER_PILL[tier]}>
          {TIER_LABEL[tier]} 패키지
        </span>
        <Link
          href="/admin/franchise/products"
          className="ml-auto text-[13px] text-rk-info no-underline hover:underline"
        >
          🛒 진열 · 배너 페이지 →
        </Link>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        본사 영업점수수료 기준 사은품 · 설치비 환원 + 영업자 마진 override · 모든 상품·옵션 공통 적용
      </p>

      <PolicyEditor />
    </>
  );
}
