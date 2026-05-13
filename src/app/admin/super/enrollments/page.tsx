import EnrollmentList from "@/components/enrollment/EnrollmentList";

export const metadata = { title: "전체 가입 신청서 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default function SuperEnrollmentsPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">📋 전체 가입 신청서</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        전국 협력점·영업자가 작성한 모든 신청서. PII 전체 평문 노출 (감사 로그).
      </p>
      <EnrollmentList scope="hq" />
    </>
  );
}
