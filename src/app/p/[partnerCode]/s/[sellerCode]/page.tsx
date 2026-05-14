import { notFound } from "next/navigation";
import PartnerSiteShell from "@/components/consumer/PartnerSiteShell";
import { getPartnerSite } from "@/lib/partnerSite";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerCode: string; sellerCode: string }>;
}) {
  const { partnerCode, sellerCode } = await params;
  const [data, seller] = await Promise.all([
    getPartnerSite(partnerCode),
    prisma.seller.findUnique({
      where: { partnerId_sellerCode: { partnerId: partnerCode, sellerCode } },
    }),
  ]);
  if (!data || !seller || seller.status !== "active") return { title: "Not Found" };
  return { title: `${seller.name} · ${data.partner.partnerName}` };
}

export default async function SellerSitePage({
  params,
}: {
  params: Promise<{ partnerCode: string; sellerCode: string }>;
}) {
  const { partnerCode, sellerCode } = await params;
  const [data, seller] = await Promise.all([
    getPartnerSite(partnerCode),
    prisma.seller.findUnique({
      where: { partnerId_sellerCode: { partnerId: partnerCode, sellerCode } },
    }),
  ]);
  if (!data) notFound();
  if (!seller || seller.status !== "active") notFound();

  return (
    <PartnerSiteShell
      data={data}
      seller={{
        sellerCode: seller.sellerCode,
        name: seller.name,
        phone: seller.phone,
      }}
    />
  );
}
