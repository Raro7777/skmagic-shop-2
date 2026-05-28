import Link from "next/link";

export const metadata = { title: "페이지를 찾을 수 없습니다" };

// 협력점 페이지 SSR payload 에도 이 컴포넌트가 streaming 되므로, 본사 핫라인 등 식별 정보를 직접 박지 않음.
// 본사 hotline 안내가 필요한 위치는 본사 컨텍스트 전용 페이지(/admin/super/*, /apply, /legal 등) 에서 따로 노출.
export default function NotFound() {
  return (
    <div className="bg-rk-soft-2 min-h-screen flex items-center justify-center px-4">
      <div className="bg-white border border-rk-line rounded-lg max-w-[480px] w-full p-8 text-center">
        <div className="text-[48px] font-bold text-rk-orange tracking-[-.02em] rk-num">404</div>
        <h1 className="text-[18px] font-bold text-rk-ink mt-2 mb-1">페이지를 찾을 수 없습니다</h1>
        <p className="text-[12px] text-rk-muted m-0 mb-6 leading-[1.6]">
          요청하신 페이지가 삭제됐거나 주소가 변경된 것 같습니다.<br />
          허브 또는 분양 사이트로 이동하시려면 아래 링크를 이용해주세요.
        </p>

        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="bg-rk-navy hover:bg-rk-navy-deep text-white py-2.5 rounded text-[13px] font-medium no-underline transition-colors"
          >
            ← 허브로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
