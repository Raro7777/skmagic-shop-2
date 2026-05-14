import ReviewApprovalClient from "@/components/super/ReviewApprovalClient";

export const metadata = { title: "후기 승인 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default function SuperReviewsPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">⭐ 후기 승인</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        협력점이 등록한 후기를 검토 후 승인 / 거절. 승인된 후기만 컨슈머 사이트에 노출됩니다.
      </p>
      <ReviewApprovalClient />
    </>
  );
}
