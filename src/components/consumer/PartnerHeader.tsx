import Link from "next/link";
import NavTabs from "@/components/consumer/NavTabs";
import type { PartnerSiteData } from "@/lib/partnerSite";

export type SellerInfo = { sellerCode: string; name: string };

export default function PartnerHeader({
  partner,
  seller,
  showFullNav = false,
  backHref,
}: {
  partner: PartnerSiteData["partner"];
  seller?: SellerInfo | null;
  /** Full nav with hotline strip + tab nav (used on home/category pages) */
  showFullNav?: boolean;
  /** Optional override for back link (defaults to partner home) */
  backHref?: string;
}) {
  return (
    <header className="bg-white border-b border-rk-line">
      {showFullNav ? (
        <>
          <div className="flex items-center justify-between px-4 py-2 text-[13px] text-rk-muted border-b border-rk-line-2">
            <div className="truncate pr-2">
              {partner.partnerName}
              {seller && <> · 담당 <b className="text-rk-orange-deep">{seller.name}</b></>}
            </div>
            <div className="flex gap-2.5 shrink-0">
              <Link href={`/p/${partner.partnerCode}/help`} className="text-rk-text no-underline cursor-pointer">고객센터</Link>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center gap-2.5">
            <Link href={`/p/${partner.partnerCode}`} className="text-[24px] text-rk-ink no-underline">≡</Link>
            <Link href={`/p/${partner.partnerCode}`} className="flex items-center gap-2 no-underline text-inherit">
              <div className="w-[28px] h-[28px] bg-rk-orange text-white rounded-[5px] grid place-items-center font-bold text-[14px]">SK</div>
              <div>
                <div className="font-bold text-[16px] text-rk-ink tracking-[-.02em] leading-tight">{partner.partnerName}</div>
                <div className="text-[13px] text-rk-muted">{partner.brandLabel}</div>
              </div>
            </Link>
            <div className="ml-auto flex gap-3.5 text-[20px] text-rk-ink">
              <Link href={`/p/${partner.partnerCode}/search`} className="text-rk-ink no-underline cursor-pointer" aria-label="검색">🔍</Link>
              <Link href="/admin/franchise" className="text-rk-ink no-underline cursor-pointer" aria-label="관리자">⚙</Link>
            </div>
          </div>
          {/* navy 영역 — 한 줄에 들어가도록 시간 hide·nowrap·gap 축소 (항목 4) */}
          <div className="bg-rk-navy text-white px-3 py-2 flex items-center gap-1.5 text-[13px]">
            <a href={`tel:${partner.hotlineNumber.replace(/[^\d+]/g, "")}`}
               className="flex items-center gap-1 no-underline text-white cursor-pointer whitespace-nowrap shrink-0">
              <span className="text-[14px]">📞</span>
              <b className="text-[14px] tracking-[.02em] rk-num">{partner.hotlineNumber}</b>
            </a>
            <span className="text-[12px] opacity-70 whitespace-nowrap hidden sm:inline">평일 09–22시</span>
            <div className="ml-auto flex gap-1 shrink-0">
              {partner.kakaoChannelUrl ? (
                <a href={partner.kakaoChannelUrl} target="_blank" rel="noreferrer"
                  className="bg-white/15 hover:bg-white/25 px-2 py-1 rounded text-[12.5px] font-medium no-underline text-white cursor-pointer whitespace-nowrap">
                  카톡상담
                </a>
              ) : (
                <a href={`tel:${partner.hotlineNumber.replace(/[^\d+]/g, "")}`}
                  className="bg-white/15 hover:bg-white/25 px-2 py-1 rounded text-[12.5px] font-medium no-underline text-white cursor-pointer whitespace-nowrap">
                  카톡상담
                </a>
              )}
              <Link href={`/p/${partner.partnerCode}#consult-form`}
                className="bg-white/15 hover:bg-white/25 px-2 py-1 rounded text-[12.5px] font-medium no-underline text-white cursor-pointer whitespace-nowrap">
                방문상담
              </Link>
            </div>
          </div>
          <NavTabs partnerCode={partner.partnerCode} />
        </>
      ) : (
        // Compact header (back + brand + cart) — used on subpages like detail/category lists
        <div className="flex items-center px-3 py-3 gap-2">
          <Link
            href={backHref ?? `/p/${partner.partnerCode}`}
            className="text-[20px] text-rk-ink no-underline"
          >
            ←
          </Link>
          <Link
            href={`/p/${partner.partnerCode}`}
            className="flex items-center gap-2 flex-1 min-w-0 no-underline text-inherit"
          >
            <div className="w-[24px] h-[24px] bg-rk-orange text-white rounded-[4px] grid place-items-center font-bold text-[13px] shrink-0">
              SK
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[13px] text-rk-ink leading-tight truncate">
                {partner.partnerName}
              </div>
              <div className="text-[12px] text-rk-muted truncate">{partner.brandLabel}</div>
            </div>
          </Link>
          <div className="flex gap-3 text-[18px] text-rk-ink shrink-0">
            <Link href={`/p/${partner.partnerCode}/search`} className="text-rk-ink no-underline cursor-pointer" aria-label="검색">🔍</Link>
            <Link href="/admin/franchise" className="text-rk-ink no-underline cursor-pointer" aria-label="관리자">⚙</Link>
          </div>
        </div>
      )}
    </header>
  );
}
