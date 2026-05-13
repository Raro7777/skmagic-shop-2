import Link from "next/link";

/**
 * 운영용 공통 푸터 — 허브 + legal 페이지에서 사용.
 * 사업자 정보·법적 표기·관리자 로그인 진입.
 */
export default function Footer() {
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
            <li>대표 전화 <b className="text-white">1600-2434</b></li>
            <li>운영시간 평일 09–22시</li>
            <li>이메일 <span className="font-mono text-[11px]">help@rentking.kr</span></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-[1100px] mx-auto px-6 py-5 flex flex-col md:flex-row gap-2 md:justify-between text-[11px] text-white/45 leading-[1.7]">
          <div>
            <b className="text-white/70">㈜렌트왕</b>
            <span className="ml-1.5">대표 강현우</span>
            <span className="ml-1.5">사업자등록번호 000-00-00000</span>
            <span className="ml-1.5">통신판매업 신고 제0000-서울-00000호</span>
            <span className="block md:inline md:ml-1.5">주소 서울특별시 (운영 본사 주소)</span>
          </div>
          <div className="text-white/40">© 2026 RENTKING · 분양형 가정용 렌탈 플랫폼</div>
        </div>
      </div>
    </footer>
  );
}
