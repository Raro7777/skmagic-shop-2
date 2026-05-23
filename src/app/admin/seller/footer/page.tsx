import { prisma } from "@/lib/prisma";
import { getEffectiveSeller } from "@/lib/effectiveSeller";
import SellerFooterEditor from "@/components/seller/SellerFooterEditor";

export const metadata = { title: "푸터 정보 · 영업자" };
export const dynamic = "force-dynamic";

export default async function SellerFooterPage() {
  const eff = await getEffectiveSeller();
  if (!eff) return null;

  const seller = await prisma.seller.findUnique({
    where: { id: eff.sellerId },
    select: {
      sellerCode: true,
      companyName: true, ownerName: true, address: true,
      businessNumber: true, commerceNumber: true, hotlineNumber: true,
      csHours: true, csLunchHours: true, csHolidays: true,
      kakaoChannelUrl: true, footerLogoUrl: true,
      partner: {
        select: {
          partnerName: true, ownerName: true, address: true,
          businessNumber: true, commerceNumber: true, hotlineNumber: true,
          csHours: true, csLunchHours: true, csHolidays: true,
          kakaoChannelUrl: true, footerLogoUrl: true,
        },
      },
    },
  });
  if (!seller) return null;

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">내 푸터 정보</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        내 영업자 페이지(/p/{eff.partnerCode}/s/{seller.sellerCode})의 푸터에만 적용됩니다.
        비워두면 협력점 정보가 그대로 노출됩니다.
      </p>

      <SellerFooterEditor
        initial={{
          companyName: seller.companyName,
          ownerName: seller.ownerName,
          address: seller.address,
          businessNumber: seller.businessNumber,
          commerceNumber: seller.commerceNumber,
          hotlineNumber: seller.hotlineNumber,
          csHours: seller.csHours,
          csLunchHours: seller.csLunchHours,
          csHolidays: seller.csHolidays,
          kakaoChannelUrl: seller.kakaoChannelUrl,
          footerLogoUrl: seller.footerLogoUrl,
        }}
        partnerDefaults={{
          companyName: seller.partner.partnerName,
          ownerName: seller.partner.ownerName,
          address: seller.partner.address,
          businessNumber: seller.partner.businessNumber,
          commerceNumber: seller.partner.commerceNumber,
          hotlineNumber: seller.partner.hotlineNumber,
          csHours: seller.partner.csHours,
          csLunchHours: seller.partner.csLunchHours,
          csHolidays: seller.partner.csHolidays,
          kakaoChannelUrl: seller.partner.kakaoChannelUrl,
          footerLogoUrl: seller.partner.footerLogoUrl,
        }}
      />
    </>
  );
}
