import SettlementSummary from "@/components/franchise/SettlementSummary";

export const metadata = { title: "정산 · 협력점 콘솔" };

export default function SettlementsPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">정산</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        본사가 설치 완료(done)로 처리한 lead가 자동으로 정산 행으로 추가됩니다 · 본사 검증 완료 후 영업일 기준 5일 이내 송금
      </p>

      <SettlementSummary />

      <div className="bg-white border border-rk-line rounded-lg p-4 text-[14px] text-rk-muted">
        <b className="text-rk-ink block mb-1">📌 정산 규칙 (룰북 8.2-7)</b>
        본 협력점이 <b className="text-rk-ink">최초 접수한 lead</b>를 <b className="text-rk-ink">본사가 설치 완료(done) 처리</b>하면 즉시 정산 행이 생성됩니다.
        본사가 lead를 done에서 다른 상태로 되돌리면 같은 트랜잭션에서 정산이 자동 cancelled로 변경됩니다.
        <br />
        <br />
        지난달/이전 정산은 별도 페이지에서 조회 가능 (출시 예정).
      </div>
    </>
  );
}
