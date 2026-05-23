import { notFound } from "next/navigation";
import PartnerSiteShell from "@/components/consumer/PartnerSiteShell";
import { getPartnerSite } from "@/lib/partnerSite";

// 협력점 설정/배너/정책 변경이 즉시 반영되어야 하므로 동적 렌더링 강제.
// 미명시 시 Vercel 이 빌드 시점 데이터로 캐시 → 렌탈지원금/배너 등이 stale.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// metadata 는 /p/[partnerCode]/layout.tsx 의 generateMetadata 에서 통합 관리됨.

export default async function PartnerSitePage({
  params,
}: {
  params: Promise<{ partnerCode: string }>;
}) {
  const { partnerCode } = await params;
  const data = await getPartnerSite(partnerCode);
  if (!data) notFound();
  return <PartnerSiteShell data={data} />;
}
