import { prisma } from "@/lib/prisma";
import { getEffectivePartner } from "@/lib/effectivePartner";
import KakaoChannelInput from "@/components/franchise/KakaoChannelInput";
import PartnerProfileEditor from "@/components/franchise/PartnerProfileEditor";
import RentalSupportInput from "@/components/franchise/RentalSupportInput";
import SellerMarginInput from "@/components/franchise/SellerMarginInput";
import { HQ_HOTLINE } from "@/lib/constants/hq";

export const metadata = { title: "사이트 설정 · 협력점 콘솔" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const eff = await getEffectivePartner();
  const partnerCode = eff?.partnerId;
  const partner = partnerCode
    ? await prisma.partner.findUnique({ where: { partnerCode } })
    : null;

  if (!partner) {
    return (
      <div className="bg-rk-tint-orange text-rk-orange-deep p-4 rounded-md text-[14px]">
        협력점 정보를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">사이트 설정</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        분양받은 사이트의 기본 정보 · 변경 시 모든 페이지(소비자·관리자) 즉시 반영
      </p>

      <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[14px] font-semibold text-rk-ink">상태 정보</h3>
        </div>
        <div className="flex items-center gap-4 text-[13px]">
          <div>
            <span className="text-rk-muted mr-1.5">상태</span>
            <span
              className={
                "text-[12px] px-1.5 py-0.5 rounded font-medium " +
                (partner.status === "active"
                  ? "bg-rk-tint-green text-rk-success"
                  : "bg-rk-soft text-rk-muted")
              }
            >
              {partner.status}
            </span>
          </div>
          <div>
            <span className="text-rk-muted mr-1.5">패키지</span>
            <span className="text-rk-ink font-medium uppercase tracking-[.04em] text-[12px]">{partner.tier}</span>
          </div>
          {partner.customDomain && (
            <div>
              <span className="text-rk-muted mr-1.5">도메인</span>
              <code className="text-rk-info text-[12px] font-mono">{partner.customDomain}</code>
              <span
                className={
                  "ml-1.5 text-[11px] px-1.5 py-px rounded font-medium " +
                  (partner.customDomainStatus === "verified"
                    ? "bg-rk-tint-green text-rk-success"
                    : "bg-rk-tint-orange text-rk-orange-deep")
                }
              >
                {partner.customDomainStatus ?? "—"}
              </span>
            </div>
          )}
        </div>
      </div>

      <PartnerProfileEditor
        initial={{
          partnerCode: partner.partnerCode,
          partnerName: partner.partnerName,
          brandLabel: partner.brandLabel,
          region: partner.region,
          address: partner.address,
          ownerName: partner.ownerName,
          hotlineNumber: partner.hotlineNumber,
          phone: partner.phone,
          businessNumber: partner.businessNumber,
          commerceNumber: partner.commerceNumber,
          telegramChatId: partner.telegramChatId,
        }}
      />

      <RentalSupportInput initial={partner.rentalSupportAmount} initialEnabled={partner.rentalSupportEnabled} />

      <SellerMarginInput
        initial={{
          type: partner.sellerMarginType as "fixed" | "percent",
          amount: partner.sellerMarginAmount,
          percent: partner.sellerMarginPercent,
        }}
      />

      <KakaoChannelInput initial={partner.kakaoChannelUrl} />

      <div className="bg-rk-tint-blue text-rk-info text-[14px] p-3 rounded-md leading-[1.6]">
        ⓘ <b>상호</b>만 본사 슈퍼관리자 승인이 필요합니다. 변경이 필요하면 본사({HQ_HOTLINE})로 문의하세요.
        그 외 항목(사업자번호 · 통신판매번호 · 브랜드 라벨 · 지역 · 대표자명 · 연락처 · 주소 · 카카오 채널)은 위에서 자율 편집 가능하며 저장 시 소비자 사이트에 즉시 반영됩니다.
      </div>
    </>
  );
}
