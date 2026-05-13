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
          <div className="flex items-center justify-between px-4 py-2 text-[11px] text-rk-muted border-b border-rk-line-2">
            <div>
              {partner.partnerName}
              {seller && <> · 담당 <b className="text-rk-orange-deep">{seller.name}</b></>}
            </div>
            <div className="flex gap-2.5">
              <a className="cursor-pointer">로그인</a>
              <a className="cursor-pointer">회원가입</a>
              <Link href={`/p/${partner.partnerCode}/help`} className="text-rk-text no-underline cursor-pointer">고객센터</Link>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center gap-2.5">
            <Link href={`/p/${partner.partnerCode}`} className="text-[22px] text-rk-ink no-underline">≡</Link>
            <Link href={`/p/${partner.partnerCode}`} className="flex items-center gap-2 no-underline text-inherit">
              <div className="w-[26px] h-[26px] bg-rk-orange text-white rounded-[5px] grid place-items-center font-bold text-[13px]">SK</div>
              <div>
                <div className="font-bold text-base text-rk-ink tracking-[-.02em]">{partner.partnerName}</div>
                <div className="text-[10px] text-rk-muted">{partner.brandLabel}</div>
              </div>
            </Link>
            <div className="ml-auto flex gap-3.5 text-lg text-rk-ink">
              <Link href={`/p/${partner.partnerCode}/search`} className="text-rk-ink no-underline cursor-pointer">🔍</Link>
              <span className="relative cursor-pointer">
                🛒
                <span className="absolute -top-1.5 -right-1.5 bg-rk-sale text-white rounded-full text-[9px] font-bold px-1 min-w-3.5 text-center">2</span>
              </span>
            </div>
          </div>
          <div className="bg-rk-navy text-white px-4 py-2.5 flex items-center gap-2 text-[13px]">
            <span>📞</span>
            <span className="text-base font-bold tracking-[.02em] rk-num">{partner.hotlineNumber}</span>
            <span className="text-[11px] opacity-80">평일 09:00–22:00</span>
            <div className="ml-auto flex gap-1.5">
              <span className="bg-white/10 px-2 py-1 rounded text-[11px]">카톡상담</span>
              <span className="bg-white/10 px-2 py-1 rounded text-[11px]">방문상담</span>
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
            <div className="w-[24px] h-[24px] bg-rk-orange text-white rounded-[4px] grid place-items-center font-bold text-[11px] shrink-0">
              SK
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[13px] text-rk-ink leading-tight truncate">
                {partner.partnerName}
              </div>
              <div className="text-[10px] text-rk-muted truncate">{partner.brandLabel}</div>
            </div>
          </Link>
          <div className="flex gap-3 text-base text-rk-ink shrink-0">
            <Link href={`/p/${partner.partnerCode}/search`} className="text-rk-ink no-underline cursor-pointer">🔍</Link>
            <span className="cursor-pointer">🛒</span>
          </div>
        </div>
      )}
    </header>
  );
}
