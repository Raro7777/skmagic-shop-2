import Link from "next/link";
import { prisma } from "@/lib/prisma";

/**
 * 운영용 공통 푸터 — 허브 + legal 페이지에서 사용.
 *
 * 사업자 정보는 본사가 운영하는 협력점(현재 인터넷끝판왕)의 Partner 데이터를
 * 그대로 노출. 본사 콘솔에서 협력점 정보 수정 시 자동 반영.
 *   ENV: `HQ_FOOTER_PARTNER_CODE` 로 변경 가능 (기본: partner-7714c0)
 */

const HQ_FOOTER_PARTNER_CODE = process.env.HQ_FOOTER_PARTNER_CODE ?? "partner-7714c0";

export default async function Footer() {
  const partner = await prisma.partner.findUnique({
    where: { partnerCode: HQ_FOOTER_PARTNER_CODE },
    select: {
      partnerName: true, ownerName: true, address: true,
      hotlineNumber: true, phone: true,
      businessNumber: true, commerceNumber: true,
      kakaoChannelUrl: true,
    },
  }).catch(() => null);

  return (
    <footer className="bg-rk-ink text-white/85 mt-16 text-[12px]">
      <div className="max-w-[1100px] mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-rk-orange text-white rounded grid place-items-center font-bold text-[12px]">RK</div>
            <b className="text-white text-[14px]">렌트왕</b>
          </div>
          <p className="text-white/55 leading-[1.7] text-[12px]">
            SK매직 공식 협력점이 운영하는 가정용 렌탈 상담 플랫폼.
            정수기·공기청정기·비데·매트리스를 동네 매장 기준 가격으로 비교 상담합니다.
          </p>
        </div>

        <div>
          <b className="block text-white mb-2">서비스</b>
          <ul className="space-y-1.5 text-white/60">
            <li><Link href="/" className="hover:text-white no-underline">전체 협력점</Link></li>
            <li><Link href="/apply" className="hover:text-white no-underline">분양 신청</Link></li>
            <li><Link href="/admin" className="hover:text-white no-underline">관리자 로그인</Link></li>
          </ul>
        </div>

        <div>
          <b className="block text-white mb-2">법적 고지</b>
          <ul className="space-y-1.5 text-white/60">
            <li><Link href="/legal/terms" className="hover:text-white no-underline">이용약관</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-white no-underline">개인정보처리방침</Link></li>
          </ul>
        </div>

        <div>
          <b className="block text-white mb-2">고객센터</b>
          <ul className="space-y-1.5 text-white/60">
            <li>대표 전화 <b className="text-white">{partner?.hotlineNumber ?? "1600-2434"}</b></li>
            <li>운영시간 평일 09–22시</li>
            {partner?.phone && <li>휴대폰 <span className="text-white/80 rk-num">{formatPhone(partner.phone)}</span></li>}
            {partner?.kakaoChannelUrl && (
              <li>
                <a
                  href={partner.kakaoChannelUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/80 hover:text-white no-underline"
                >
                  💬 카카오 채널 상담
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-[1100px] mx-auto px-6 py-5 flex flex-col md:flex-row gap-2 md:justify-between text-[11px] text-white/45 leading-[1.7]">
          <div>
            <b className="text-white/70">{partner?.partnerName ?? "㈜렌트왕"}</b>
            {partner?.ownerName && <span className="ml-1.5">대표 {partner.ownerName}</span>}
            {partner?.businessNumber && <span className="ml-1.5">사업자등록번호 {partner.businessNumber}</span>}
            {partner?.commerceNumber && <span className="ml-1.5">통신판매업 신고 {partner.commerceNumber}</span>}
            {partner?.address && <span className="block md:inline md:ml-1.5">주소 {partner.address}</span>}
          </div>
          <div className="text-white/40">© 2026 RENTKING · 분양형 가정용 렌탈 플랫폼</div>
        </div>
      </div>
    </footer>
  );
}

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}
