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

  // sticky: 항상 뷰포트 하단에 고정 (항목 11)
  return (
    <div className="sticky bottom-0 px-3 py-2.5 bg-white border-t border-rk-line flex gap-1.5 items-center z-30 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      {/* 전화 상담 */}
      <a
        href={telHref}
        className="flex-1 bg-rk-navy hover:bg-rk-navy-deep text-white py-3 rounded-lg font-semibold text-[13.5px] no-underline cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
        title={`전화 ${partner.hotlineNumber}`}
      >
        📞 전화상담
      </a>
      {/* 카톡 상담 */}
      {kakaoUrl ? (
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-[#FEE500] hover:bg-[#F4DC00] text-[#1A1D24] py-3 rounded-lg font-semibold text-[13.5px] no-underline cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
          title={`${partner.partnerName} 카톡채널`}
        >
          💬 카톡상담
        </a>
      ) : (
        <a
          href={telHref}
          className="flex-1 bg-[#FEE500] text-[#1A1D24] py-3 rounded-lg font-semibold text-[13.5px] no-underline cursor-pointer flex items-center justify-center gap-1.5"
          title="카톡 채널 미설정 — 전화로 연결"
        >
          💬 카톡상담
        </a>
      )}
      {/* 상담 신청 (폼 열림) */}
      <ConsultForm
        partnerCode={partner.partnerCode}
        partnerName={partner.partnerName}
        sellerCode={seller?.sellerCode}
        sellerName={seller?.name}
        defaultProductCode={defaultProductCode}
        defaultProductLabel={defaultProductLabel}
        buttonLabel="✍ 상담신청"
        buttonClassName="flex-1 bg-rk-orange hover:bg-rk-orange-deep text-white py-3 rounded-lg font-semibold text-[13.5px] cursor-pointer border-0 transition-colors flex items-center justify-center gap-1.5"
      />
    </div>
  );
}
