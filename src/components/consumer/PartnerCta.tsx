"use client";

import ConsultForm from "@/components/consumer/ConsultForm";
import type { PartnerSiteData } from "@/lib/partnerSite";
import { HQ_HOTLINE } from "@/lib/constants/hq";
import { naverTrans } from "@/lib/naverWcsTrans";

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
  const showTel = !!partner.hotlineNumber && partner.hotlineNumber !== HQ_HOTLINE;
  const telHref = showTel ? `tel:${partner.hotlineNumber.replace(/\D/g, "")}` : null;

  // sticky: 항상 뷰포트 하단에 고정 (항목 11)
  return (
    <div
      className="sticky bottom-0 px-3 py-2.5 bg-white border-t border-rk-line flex gap-1.5 items-center z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* 전화 상담 — 협력점 자체 핫라인이 있을 때만 노출 (본사 1600-2434 노출 차단) */}
      {telHref && (
        <a
          href={telHref}
          onMouseDown={() => naverTrans("custom001")}
          className="flex-1 bg-rk-navy hover:bg-rk-navy-deep text-white py-3 rounded-lg font-semibold text-[13px] no-underline cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
          title={`전화 ${partner.hotlineNumber}`}
        >
          📞 전화상담
        </a>
      )}
      {/* 카톡 상담 */}
      {kakaoUrl ? (
        <a
          href={kakaoUrl}
          onMouseDown={() => naverTrans("custom002")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-[#FEE500] hover:bg-[#F4DC00] text-[#1A1D24] py-3 rounded-lg font-semibold text-[13px] no-underline cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
          title={`${partner.partnerName} 카톡채널`}
        >
          <img src="https://internet-king.kr/gaeun_landing/kakao.png" alt="" className="w-[18px] h-[18px] shrink-0" />
          카톡상담
        </a>
      ) : telHref ? (
        <a
          href={telHref}
          onMouseDown={() => naverTrans("custom001")}
          className="flex-1 bg-[#FEE500] text-[#1A1D24] py-3 rounded-lg font-semibold text-[13px] no-underline cursor-pointer flex items-center justify-center gap-1.5"
          title="카톡 채널 미설정 — 전화로 연결"
        >
          <img src="https://internet-king.kr/gaeun_landing/kakao.png" alt="" className="w-[18px] h-[18px] shrink-0" />
          카톡상담
        </a>
      ) : null}
      {/* 상담 신청 (폼 열림) */}
      <ConsultForm
        partnerCode={partner.partnerCode}
        partnerName={partner.partnerName}
        sellerCode={seller?.sellerCode}
        sellerName={seller?.name}
        defaultProductCode={defaultProductCode}
        defaultProductLabel={defaultProductLabel}
        buttonLabel="✍ 상담신청"
        buttonClassName="flex-1 bg-rk-orange hover:bg-rk-orange-deep text-white py-3 rounded-lg font-semibold text-[13px] cursor-pointer border-0 transition-colors flex items-center justify-center gap-1.5"
      />
    </div>
  );
}
