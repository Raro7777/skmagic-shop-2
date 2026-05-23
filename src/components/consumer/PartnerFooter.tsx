import Link from "next/link";
import type { PartnerSiteData } from "@/lib/partnerSite";
import { HQ_HOTLINE } from "@/lib/constants/hq";

export default function PartnerFooter({ partner }: { partner: PartnerSiteData["partner"] }) {
  // 협력점 본인이 자체 번호를 입력한 경우만 footer 에 표시. schema default
  // (본사 핫라인) 인 경우 본사 번호가 협력점 footer 로 노출되지 않도록 행 숨김.
  const showHotline = partner.hotlineNumber && partner.hotlineNumber !== HQ_HOTLINE;
  return (
    <footer className="bg-rk-soft px-3.5 py-4 text-[13px] text-rk-muted leading-[1.7]">
      {/* 협력점 로고 — 업로드한 경우만 푸터 상단에 표시. 헤더는 본사 정책상 SK매직 공식 로고 고정. */}
      {partner.footerLogoUrl && (
        <div className="mb-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={partner.footerLogoUrl}
            alt={`${partner.companyName} 로고`}
            className="max-h-[48px] max-w-[200px] object-contain"
          />
        </div>
      )}
      <div className="flex gap-2.5 flex-wrap mb-2.5 text-[13px]">
        <Link href="/legal/terms" className="text-rk-ink font-semibold no-underline cursor-pointer">이용약관</Link>
        <Link href="/legal/privacy" className="text-rk-ink font-semibold no-underline cursor-pointer">개인정보처리방침</Link>
        <Link href={`/p/${partner.partnerCode}/help`} className="text-rk-text no-underline cursor-pointer">고객센터</Link>
        <Link href={`/p/${partner.partnerCode}/help`} className="text-rk-text no-underline cursor-pointer">설치 A/S</Link>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 m-0">
        <dt className="text-rk-faint m-0">상호</dt>
        <dd className="m-0">{partner.companyName}</dd>
        {partner.ownerName && (
          <>
            <dt className="text-rk-faint m-0">대표</dt>
            <dd className="m-0">{partner.ownerName}</dd>
          </>
        )}
        {partner.address && (
          <>
            <dt className="text-rk-faint m-0">주소</dt>
            <dd className="m-0">{partner.address}</dd>
          </>
        )}
        {partner.businessNumber && (
          <>
            <dt className="text-rk-faint m-0">사업자</dt>
            <dd className="m-0 rk-num">{partner.businessNumber}</dd>
          </>
        )}
        {partner.commerceNumber && (
          <>
            <dt className="text-rk-faint m-0">통신판매</dt>
            <dd className="m-0 rk-num">{partner.commerceNumber}</dd>
          </>
        )}
        {showHotline && (
          <>
            <dt className="text-rk-faint m-0">고객센터</dt>
            <dd className="m-0 rk-num">
              {partner.hotlineNumber}
              {partner.csHours && <span className="ml-1 text-rk-faint">({partner.csHours})</span>}
            </dd>
          </>
        )}
        {(partner.csLunchHours || partner.csHolidays) && (
          <>
            <dt className="text-rk-faint m-0">운영안내</dt>
            <dd className="m-0">
              {partner.csLunchHours && <span>점심 {partner.csLunchHours}</span>}
              {partner.csLunchHours && partner.csHolidays && <span className="mx-1 text-rk-faint">·</span>}
              {partner.csHolidays && <span>휴무 {partner.csHolidays}</span>}
            </dd>
          </>
        )}
      </dl>
    </footer>
  );
}
