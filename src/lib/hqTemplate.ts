/**
 * 본사 표준(hq-template) → 신규 협력점 / 협력점 → 신규 영업자 1회 복제 (Snapshot).
 *
 * 정책:
 *   - 협력점 생성 시: 본사 표준의 배너·진열·테마·정책 복제 (푸터 정보 X — 신청서 데이터로 채움)
 *   - 영업자 생성 시: 협력점 footer 11필드 복제 (영업자가 본인 콘솔에서 자유 수정 가능)
 *   - 본사 표준이 바뀌어도 기존 협력점·영업자에 영향 X.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

export const HQ_TEMPLATE_PARTNER_CODE = "hq-template";

type Tx = PrismaClient | Prisma.TransactionClient;

/**
 * 본사 표준의 배너 + 진열/테마/정책 기본값을 새 협력점에 복제.
 * 신규 partner row 는 이미 create 되어 있어야 함. 그 위에 update + insert.
 *
 *   - Partner.theme / displayConfig / rentalSupportAmount / rentalSupportEnabled / sellerMargin*
 *     → 본사 표준 값으로 update
 *   - Banner (scope="partner", partnerId=hq-template) → 새 partner 로 복제
 *   - PartnerPolicy (상품별 사은품·설치비 환원 등) → 새 partner 로 복제
 *
 * 푸터 정보(partnerName, businessNumber, address, ownerName, hotline, cs*, kakao, footerLogo) 는
 * 협력점 신청서 데이터로 채워지므로 복제 대상 아님.
 */
export async function cloneHqTemplateToPartner(tx: Tx, newPartnerCode: string): Promise<{
  copiedBanners: number;
  copiedPolicies: number;
  cloned: boolean;
}> {
  const tpl = await tx.partner.findUnique({
    where: { partnerCode: HQ_TEMPLATE_PARTNER_CODE },
    select: {
      theme: true, displayConfig: true,
      rentalSupportAmount: true, rentalSupportEnabled: true,
      sellerMarginType: true, sellerMarginAmount: true, sellerMarginPercent: true,
    },
  });
  if (!tpl) return { copiedBanners: 0, copiedPolicies: 0, cloned: false };

  // Partner 설정 복제 (푸터 X)
  await tx.partner.update({
    where: { partnerCode: newPartnerCode },
    data: {
      theme: tpl.theme,
      displayConfig: tpl.displayConfig as Prisma.InputJsonValue ?? undefined,
      rentalSupportAmount: tpl.rentalSupportAmount,
      rentalSupportEnabled: tpl.rentalSupportEnabled,
      sellerMarginType: tpl.sellerMarginType,
      sellerMarginAmount: tpl.sellerMarginAmount,
      sellerMarginPercent: tpl.sellerMarginPercent,
    },
  });

  // Banner 복제 — scope="partner" (global 은 모든 협력점 공통이라 복제 불필요)
  const banners = await tx.banner.findMany({
    where: { partnerId: HQ_TEMPLATE_PARTNER_CODE, scope: "partner" },
  });
  let copiedBanners = 0;
  for (const b of banners) {
    await tx.banner.create({
      data: {
        partnerId: newPartnerCode,
        scope: "partner",
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl,
        bgColor1: b.bgColor1,
        bgColor2: b.bgColor2,
        textColor: b.textColor,
        ctaLabel: b.ctaLabel,
        ctaHref: b.ctaHref,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        priority: b.priority,
        status: b.status,
        layout: b.layout,
        spotlightProductCode: b.spotlightProductCode,
        stampText: b.stampText,
        htmlContent: b.htmlContent,
        sourceTemplateId: b.sourceTemplateId,
      },
    });
    copiedBanners++;
  }

  // PartnerPolicy 복제 (상품별 사은품·설치비 환원·영업자 마진 override 등)
  const policies = await tx.partnerPolicy.findMany({
    where: { partnerId: HQ_TEMPLATE_PARTNER_CODE },
  });
  let copiedPolicies = 0;
  for (const pp of policies) {
    await tx.partnerPolicy.create({
      data: {
        partnerId: newPartnerCode,
        productId: pp.productId,
        giftLabel: pp.giftLabel,
        giftAmount: pp.giftAmount,
        installAmount: pp.installAmount,
        sellerMarginAmount: pp.sellerMarginAmount,
        sellerMarginPercent: pp.sellerMarginPercent,
      },
    });
    copiedPolicies++;
  }

  return { copiedBanners, copiedPolicies, cloned: true };
}

/**
 * 신규 영업자 생성 시 협력점 footer 11필드를 영업자 row 에 1회 복제.
 * 영업자가 콘솔에서 수정하기 전까지 협력점 footer 그대로 노출.
 */
export async function cloneFooterFromPartner(tx: Tx, partnerCode: string): Promise<{
  companyName: string | null;
  ownerName: string | null;
  address: string | null;
  businessNumber: string | null;
  commerceNumber: string | null;
  hotlineNumber: string | null;
  csHours: string | null;
  csLunchHours: string | null;
  csHolidays: string | null;
  kakaoChannelUrl: string | null;
  footerLogoUrl: string | null;
}> {
  const p = await tx.partner.findUnique({
    where: { partnerCode },
    select: {
      partnerName: true, ownerName: true, address: true,
      businessNumber: true, commerceNumber: true, hotlineNumber: true,
      csHours: true, csLunchHours: true, csHolidays: true,
      kakaoChannelUrl: true, footerLogoUrl: true,
    },
  });
  if (!p) {
    return {
      companyName: null, ownerName: null, address: null,
      businessNumber: null, commerceNumber: null, hotlineNumber: null,
      csHours: null, csLunchHours: null, csHolidays: null,
      kakaoChannelUrl: null, footerLogoUrl: null,
    };
  }
  return {
    companyName: p.partnerName,         // Seller.companyName ← partner 상호
    ownerName: p.ownerName,
    address: p.address,
    businessNumber: p.businessNumber,
    commerceNumber: p.commerceNumber,
    hotlineNumber: p.hotlineNumber,
    csHours: p.csHours,
    csLunchHours: p.csLunchHours,
    csHolidays: p.csHolidays,
    kakaoChannelUrl: p.kakaoChannelUrl,
    footerLogoUrl: p.footerLogoUrl,
  };
}
