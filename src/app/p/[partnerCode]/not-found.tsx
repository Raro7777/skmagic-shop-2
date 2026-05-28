export const metadata = { title: "페이지를 찾을 수 없습니다" };

// 협력점 컨텍스트 전용 404 — 본사 핫라인(1600-2434) 노출 금지.
// 협력점 페이지 SSR payload 에 inline 으로 streaming 되므로, 본사 식별 정보 없이 일반 안내만 노출.
export default function PartnerNotFound() {
  return (
    <div className="bg-rk-soft-2 min-h-screen flex items-center justify-center px-4">
      <div className="bg-white border border-rk-line rounded-lg max-w-[480px] w-full p-8 text-center">
        <div className="text-[48px] font-bold text-rk-orange tracking-[-.02em] rk-num">404</div>
        <h1 className="text-[18px] font-bold text-rk-ink mt-2 mb-1">페이지를 찾을 수 없습니다</h1>
        <p className="text-[12px] text-rk-muted m-0 leading-[1.6]">
          요청하신 페이지가 삭제됐거나 주소가 변경된 것 같습니다.<br />
          이전 페이지로 돌아가거나, 협력점 메인에서 다시 시작해 주세요.
        </p>
      </div>
    </div>
  );
}
