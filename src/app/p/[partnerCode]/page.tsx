import { notFound } from "next/navigation";
import PartnerSiteShell from "@/components/consumer/PartnerSiteShell";
import { getPartnerSite } from "@/lib/partnerSite";

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
