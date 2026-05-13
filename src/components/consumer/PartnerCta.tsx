import ConsultForm from "@/components/consumer/ConsultForm";
import type { PartnerSiteData } from "@/lib/partnerSite";

export default function PartnerCta({
  partner,
  seller,
  defaultProductCode,
  defaultProductLabel,
}: {
  partner: PartnerSiteData["partner"];
  seller?: { sellerCode: string; name: string } | null;
  defaultProductCode?: string;
  defaultProductLabel?: string;
}) {
  const kakaoUrl = partner.kakaoChannelUrl;
  const telHref = `tel:${partner.hotlineNumber.replace(/\D/g, "")}`;

  return (
    <div className="sticky bottom-0 px-3.5 py-2.5 bg-white border-t border-rk-line flex gap-2 items-center z-10">
      <a
        href={telHref}
        className="bg-rk-soft text-rk-ink px-3 py-3 rounded-lg font-semibold text-[12px] no-underline cursor-pointer flex items-center justify-center"
        title={`전화 ${partner.hotlineNumber}`}
      >
        📞
      </a>
      {kakaoUrl ? (
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#FEE500] text-[#1A1D24] px-3 py-3 rounded-lg font-semibold text-[12px] no-underline cursor-pointer flex items-center justify-center"
          title={`${partner.partnerName} 카톡채널`}
        >
          💬
        </a>
      ) : (
        <span
          className="bg-rk-soft-2 text-rk-faint px-3 py-3 rounded-lg font-semibold text-[12px] flex items-center justify-center cursor-not-allowed"
          title="카카오톡 채널 연결 준비 중"
        >
          💬
        </span>
      )}
      <ConsultForm
        partnerCode={partner.partnerCode}
        partnerName={partner.partnerName}
        sellerCode={seller?.sellerCode}
        sellerName={seller?.name}
        defaultProductCode={defaultProductCode}
        defaultProductLabel={defaultProductLabel}
        buttonClassName="flex-1 bg-rk-orange hover:bg-rk-orange-deep text-white py-3 rounded-lg font-semibold text-[13px] cursor-pointer border-0 transition-colors"
      />
    </div>
  );
}
