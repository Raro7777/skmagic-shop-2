import ReviewEditorClient from "@/components/franchise/ReviewEditorClient";

export const metadata = { title: "후기 등록 · 협력점" };
export const dynamic = "force-dynamic";

export default function FranchiseReviewsPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">📸 설치 후기 등록</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        고객 동의 하에 설치 후기를 등록합니다. 본사 검토 후 승인된 후기만 컨슈머 사이트에 노출됩니다.
      </p>
      <ReviewEditorClient />
    </>
  );
}
