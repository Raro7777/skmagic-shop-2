import EnrollmentList from "@/components/enrollment/EnrollmentList";

export const metadata = { title: "내 신청서 · 영업자 콘솔" };
export const dynamic = "force-dynamic";

export default function SellerEnrollmentsPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">📝 내 가입 신청서</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        내가 받은 lead 의 신청서. 본인이 입력한 PII 만 평문 노출.
      </p>
      <EnrollmentList scope="seller" />
    </>
  );
}
