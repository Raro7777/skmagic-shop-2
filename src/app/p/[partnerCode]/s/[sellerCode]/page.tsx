import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PartnerSiteShell from "@/components/consumer/PartnerSiteShell";
import { getPartnerSite, applySellerFooterOverrides } from "@/lib/partnerSite";
import { prisma } from "@/lib/prisma";

// 영업자 sellerMargin / footer override / 협력점 정책 변경이 즉시 반영되어야 함.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerCode: string; sellerCode: string }>;
}): Promise<Metadata> {
  const { partnerCode, sellerCode } = await params;
  const [data, seller] = await Promise.all([
    getPartnerSite(partnerCode, { sellerCode }),
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
    getPartnerSite(partnerCode, { sellerCode }),
    prisma.seller.findUnique({
      where: { partnerId_sellerCode: { partnerId: partnerCode, sellerCode } },
    }),
  ]);
  if (!data) notFound();
  if (!seller || seller.status !== "active") notFound();

  // 영업자가 본인 푸터 override 입력했으면 협력점 값 위에 덮어씀.
  // 각 필드 null 이면 협력점 값 유지 (미설정 시 폴백).
  const dataWithSellerFooter = {
    ...data,
    partner: applySellerFooterOverrides(data.partner, {
      companyName:     seller.companyName,
      ownerName:       seller.ownerName,
      address:         seller.address,
      businessNumber:  seller.businessNumber,
      commerceNumber:  seller.commerceNumber,
      hotlineNumber:   seller.hotlineNumber,
      csHours:         seller.csHours,
      csLunchHours:    seller.csLunchHours,
      csHolidays:      seller.csHolidays,
      kakaoChannelUrl: seller.kakaoChannelUrl,
      footerLogoUrl:   seller.footerLogoUrl,
    }),
  };

  return (
    <PartnerSiteShell
      data={dataWithSellerFooter}
      seller={{
        sellerCode: seller.sellerCode,
        name: seller.name,
        phone: seller.phone,
      }}
    />
  );
}
