import { notFound } from "next/navigation";
import PartnerSiteShell from "@/components/consumer/PartnerSiteShell";
import { getPartnerSite } from "@/lib/partnerSite";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerCode: string }>;
}) {
  const { partnerCode } = await params;
  const data = await getPartnerSite(partnerCode);
  if (!data) return { title: "Not Found" };
  return { title: `${data.partner.partnerName} · ${data.partner.brandLabel}` };
}

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
