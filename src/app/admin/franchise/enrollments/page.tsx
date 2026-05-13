import EnrollmentList from "@/components/enrollment/EnrollmentList";

export const metadata = { title: "가입 신청서 · 협력점 콘솔" };
export const dynamic = "force-dynamic";

export default function PartnerEnrollmentsPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">📝 가입 신청서</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        본 협력점에서 작성된 신청서 전체. 잠금 상태(설치대기 이후) 는 본사 잠금 해제 필요.
      </p>
      <EnrollmentList scope="partner" />
    </>
  );
}
