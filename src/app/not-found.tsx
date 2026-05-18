import Link from "next/link";
import { HQ_HOTLINE } from "@/lib/constants/hq";

export const metadata = { title: "페이지를 찾을 수 없습니다 · 렌트왕" };

export default function NotFound() {
  return (
    <div className="bg-rk-soft-2 min-h-screen flex items-center justify-center px-4">
      <div className="bg-white border border-rk-line rounded-lg max-w-[480px] w-full p-8 text-center">
        <div className="text-[48px] font-bold text-rk-orange tracking-[-.02em] rk-num">404</div>
        <h1 className="text-[18px] font-bold text-rk-ink mt-2 mb-1">페이지를 찾을 수 없습니다</h1>
        <p className="text-[12px] text-rk-muted m-0 mb-6 leading-[1.6]">
          요청하신 페이지가 삭제됐거나 주소가 변경된 것 같습니다.<br />
          분양 사이트나 어드민 콘솔로 이동하시려면 아래 링크를 이용해주세요.
        </p>

        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="bg-rk-navy hover:bg-rk-navy-deep text-white py-2.5 rounded text-[13px] font-medium no-underline transition-colors"
          >
            ← 허브로 돌아가기
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-rk-line-2 text-[11px] text-rk-faint">
          문제가 계속되면 {HQ_HOTLINE}로 연락 주세요.
        </div>
      </div>
    </div>
  );
}
