import Link from "next/link";
import NewProductForm from "./NewProductForm";

export const metadata = { title: "신규 상품 등록 · 슈퍼관리자" };

export default function NewProductPage() {
  return (
    <>
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <Link href="/admin/super/products" className="text-[14px] text-rk-info no-underline">← 상품 마스터</Link>
        <h1 className="text-[20px] font-bold tracking-[-.02em]">신규 상품 등록</h1>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        등록 즉시 모든 협력점 사이트에 노출되며, 협력점은 자율적으로 사은품 정책을 추가할 수 있습니다.
      </p>

      <NewProductForm />
    </>
  );
}
