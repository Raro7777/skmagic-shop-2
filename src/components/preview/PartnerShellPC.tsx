import Link from "next/link";
import type { PartnerSiteData } from "@/lib/partnerSite";

/**
 * 협력점 매장 사이트 PC 버전 Shell.
 *  - 풀 너비 헤더 (로고 + 가로 카테고리 메뉴 + 검색 + 콜센터)
 *  - 컨텐츠 max-w-[1280px] 가운데 정렬
 *  - 푸터 4열
 *
 * 모바일에서도 같은 컴포넌트 — Tailwind 으로 헤더/카테고리 매니드 축소. 그러나 본 컴포넌트는
 * PC 패스(lg+)를 우선 시각화. 모바일 best 는 기존 PartnerSiteShell (별 경로).
 */
export default function PartnerShellPC({
  partner,
  children,
  categories,
  partnerCode,
  isPreview = true,
}: {
  partner: PartnerSiteData["partner"];
  children: React.ReactNode;
  categories: PartnerSiteData["categories"];
  partnerCode: string;
  isPreview?: boolean;
}) {
  return (
    <div className="bg-white min-h-screen">
      {/* Top utility bar — 작은 회색 띠 */}
      <div className="bg-rk-ink text-white text-[11px]">
        <div className="max-w-[1280px] mx-auto px-6 py-1.5 flex items-center justify-between flex-wrap gap-2">
          <span className="text-white/70">
            {isPreview && <span className="mr-2 bg-rk-orange text-white px-1.5 py-0.5 rounded text-[10px] font-medium">PREVIEW</span>}
            전국 무료 설치 · 5/19까지 가입 시 추가 사은품
          </span>
          <span className="text-white/80 flex items-center gap-3">
            <a href={`tel:${partner.hotlineNumber}`} className="text-white no-underline hover:text-rk-orange">📞 {partner.hotlineNumber}</a>
            {partner.kakaoChannelUrl && (
              <a href={partner.kakaoChannelUrl} target="_blank" rel="noreferrer" className="text-white no-underline hover:text-rk-orange">💬 카톡 상담</a>
            )}
          </span>
        </div>
      </div>

      {/* Main nav */}
      <header className="border-b border-rk-line bg-white sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center gap-8">
          <Link href={`/preview/p/${partnerCode}`} className="flex items-center gap-2.5 no-underline">
            <div className="w-9 h-9 bg-rk-navy text-white rounded grid place-items-center font-bold text-[13px]">SK</div>
            <div>
              <div className="font-bold text-[15px] text-rk-ink leading-none tracking-[-.02em]">{partner.partnerName}</div>
              <small className="block text-[10px] text-rk-muted mt-0.5">{partner.brandLabel}</small>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5 flex-1">
            {categories.map(c => (
              <Link
                key={c.slug}
                href={`/preview/p/${partnerCode}/products?category=${c.slug}`}
                className="px-3 py-1.5 rounded text-[13px] text-rk-text no-underline hover:bg-rk-soft hover:text-rk-orange transition-colors font-medium"
              >
                <span className="mr-1">{c.icon}</span>{c.label}
              </Link>
            ))}
          </nav>

          <Link
            href={`/preview/p/${partnerCode}/search`}
            className="px-3 py-1.5 rounded border border-rk-line text-[12px] text-rk-muted no-underline hover:border-rk-navy transition-colors"
          >
            🔍 상품 검색
          </Link>
          <a
            href="#consult"
            className="bg-rk-orange hover:bg-rk-orange-deep text-white px-4 py-2 rounded-md text-[13px] font-semibold no-underline transition-colors"
          >
            📞 상담 신청
          </a>
        </div>
      </header>

      {/* Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-rk-soft-2 border-t border-rk-line mt-12">
        <div className="max-w-[1280px] mx-auto px-6 py-10 grid grid-cols-4 gap-8 text-[12px]">
          <div>
            <b className="block text-rk-ink text-[13px] mb-2">{partner.partnerName}</b>
            <p className="text-rk-muted leading-[1.7] m-0">
              {partner.brandLabel}<br />
              {partner.region}<br />
              {partner.address}
            </p>
          </div>
          <div>
            <b className="block text-rk-ink text-[13px] mb-2">고객센터</b>
            <p className="text-rk-muted leading-[1.7] m-0">
              📞 <a href={`tel:${partner.hotlineNumber}`} className="text-rk-info no-underline">{partner.hotlineNumber}</a><br />
              평일 09:00 - 18:00<br />
              점심시간 12:00 - 13:00
            </p>
          </div>
          <div>
            <b className="block text-rk-ink text-[13px] mb-2">사업자 정보</b>
            <p className="text-rk-muted leading-[1.7] m-0">
              대표: {partner.ownerName ?? "—"}<br />
              사업자: {partner.businessNumber ?? "—"}<br />
              통신판매: {partner.commerceNumber ?? "—"}
            </p>
          </div>
          <div>
            <b className="block text-rk-ink text-[13px] mb-2">바로가기</b>
            <ul className="m-0 p-0 list-none text-rk-muted leading-[1.85]">
              <li><Link href={`/preview/p/${partnerCode}/products`} className="text-rk-text no-underline hover:text-rk-orange">전체 상품</Link></li>
              <li><Link href={`/preview/p/${partnerCode}/reviews`} className="text-rk-text no-underline hover:text-rk-orange">고객 리뷰</Link></li>
              <li><Link href={`/preview/p/${partnerCode}/search`} className="text-rk-text no-underline hover:text-rk-orange">상품 검색</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-rk-line-2">
          <div className="max-w-[1280px] mx-auto px-6 py-3 text-[10px] text-rk-faint flex justify-between flex-wrap gap-2">
            <span>© {partner.partnerName} · SK매직 인증판매점</span>
            <span>이 페이지는 <b>/preview/p/{partnerCode}</b> — 실제 사이트: <Link href={`/p/${partnerCode}`} className="text-rk-info no-underline">/p/{partnerCode}</Link></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
