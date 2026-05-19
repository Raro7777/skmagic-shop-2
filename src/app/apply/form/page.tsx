import Link from "next/link";
import ApplyForm from "../ApplyForm";
import { HQ_HOTLINE, HQ_COMPANY_NAME } from "@/lib/constants/hq";

export const metadata = {
  title: "분양 신청서 작성",
  description: "SK매직 공식인증점 분양에 필요한 정보만 간단히 입력하고 제출하세요. 본사 검토 후 1~2 영업일 내 연락드립니다.",
};

export const dynamic = "force-dynamic";

/**
 * 단순 분양 신청서 — 마케팅 랜딩(/apply) 없이 신청서만 노출.
 * 본사 슈퍼관리자가 카톡/문자 등으로 짧은 안내 + 이 URL 만 보내는 용도.
 */
export default function ApplyFormSimplePage() {
  return (
    <div className="bg-rk-soft-2 min-h-screen">
      {/* 짧은 헤더 */}
      <header className="bg-white border-b border-rk-line">
        <div className="max-w-[640px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/apply" className="flex items-center gap-2 no-underline text-rk-text">
            <div className="w-6 h-6 bg-rk-orange text-white rounded grid place-items-center font-bold text-[11px]">SK</div>
            <b className="text-rk-ink text-[14px]">SK매직 공식인증점 모집</b>
          </Link>
          <Link href="/apply" className="ml-auto text-[12px] text-rk-info no-underline">상세 안내 보기 →</Link>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-[640px] mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-6">
          <h1 className="text-[22px] md:text-[26px] font-bold text-rk-ink tracking-[-.02em] m-0">
            분양 신청서 작성
          </h1>
          <p className="text-[13px] text-rk-muted mt-2 m-0 leading-[1.6]">
            아래 정보만 입력하시면 됩니다. 본사 운영팀이 1~2 영업일 내 연락드립니다.
          </p>
        </div>

        <ApplyForm />

        <div className="text-center mt-5">
          <small className="text-[12px] text-rk-muted">
            궁금한 점은 본사 고객센터로 연락 주세요 · {HQ_HOTLINE}
          </small>
        </div>
      </main>

      {/* 약식 푸터 */}
      <footer className="border-t border-rk-line bg-white">
        <div className="max-w-[640px] mx-auto px-4 py-5 text-[11px] text-rk-muted leading-[1.7] flex flex-wrap gap-3">
          <Link href="/legal/terms" className="text-rk-text no-underline">이용약관</Link>
          <Link href="/legal/privacy" className="text-rk-text no-underline">개인정보처리방침</Link>
          <Link href="/" className="text-rk-text no-underline">허브</Link>
          <span className="ml-auto text-rk-faint">© {HQ_COMPANY_NAME} · 통신판매중개자 · {HQ_HOTLINE}</span>
        </div>
      </footer>
    </div>
  );
}
