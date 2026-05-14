import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PartnerSiteShell from "@/components/consumer/PartnerSiteShell";
import { getPartnerSite } from "@/lib/partnerSite";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerCode: string; sellerCode: string }>;
}): Promise<Metadata> {
  const { partnerCode, sellerCode } = await params;
  const [data, seller] = await Promise.all([
    getPartnerSite(partnerCode),
    prisma.seller.findUnique({
      where: { partnerId_sellerCode: { partnerId: partnerCode, sellerCode } },
    }),
  ]);
  if (!data || !seller || seller.status !== "active") return { title: { absolute: "Not Found" } };
  const partnerName = data.partner.partnerName;
  const titleStr = `${partnerName} · 담당 ${seller.name}`;
  const desc = `${partnerName} ${seller.name} 영업자가 직접 안내해드리는 SK매직 렌탈 상담 — 정수기·공기청정기·비데·매트리스`;
  return {
    title: { absolute: titleStr },
    description: desc,
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: partnerName,
      title: titleStr,
      description: desc,
    },
  };
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
