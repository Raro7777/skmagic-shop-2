import Link from "next/link";
import type { PartnerSiteData } from "@/lib/partnerSite";

export default function PartnerFooter({ partner }: { partner: PartnerSiteData["partner"] }) {
  return (
    <footer className="bg-rk-soft px-3.5 py-4 text-[11px] text-rk-muted leading-[1.7]">
      <div className="flex gap-2.5 flex-wrap mb-2.5 text-[11px]">
        <Link href="/legal/terms" className="text-rk-ink font-semibold no-underline cursor-pointer">이용약관</Link>
        <Link href="/legal/privacy" className="text-rk-ink font-semibold no-underline cursor-pointer">개인정보처리방침</Link>
        <Link href={`/p/${partner.partnerCode}/help`} className="text-rk-text no-underline cursor-pointer">고객센터</Link>
        <Link href={`/p/${partner.partnerCode}/help`} className="text-rk-text no-underline cursor-pointer">설치 A/S</Link>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 m-0">
        <dt className="text-rk-faint m-0">상호</dt>
        <dd className="m-0">
          {partner.partnerName} ({partner.brandLabel})
        </dd>
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
        <dt className="text-rk-faint m-0">고객센터</dt>
        <dd className="m-0 rk-num">{partner.hotlineNumber} (평일 09:00–22:00)</dd>
      </dl>
      <p className="text-[10px] text-rk-faint mt-3 pt-2.5 border-t border-rk-line">
        본 사이트는 ㈜렌트왕 분양형 렌탈 플랫폼의 가맹사이트이며, 통신판매중개자는 ㈜렌트왕입니다. 실제 상품 공급 및 설치는 SK매직㈜에서 담당합니다.
      </p>
    </footer>
  );
}
