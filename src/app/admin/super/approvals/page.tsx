import ApprovalQueue from "@/components/super/ApprovalQueue";

export const metadata = { title: "승인 대기열 · 슈퍼관리자" };

export default function ApprovalsPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">승인 대기열</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        협력점 가입 · 수수료 인상 · 정산 이의 · 브랜드 입점 — 승인 시 트랜잭션으로 정책에 자동 반영
      </p>

      <ApprovalQueue />
    </>
  );
}
