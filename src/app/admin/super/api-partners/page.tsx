import ApiPartnerManager from "@/components/super/ApiPartnerManager";
import { SITE_URL } from "@/lib/constants/site";

export const metadata = { title: "외부 API 채널 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default function ApiPartnersPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">외부 API 채널</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        쿠팡 / 11번가 / 자체 카페24 등 외부 사이트가 우리 상품을 자기 카테고리에 노출 + 신청을 우리에게 넘기는 채널
      </p>

      <ApiPartnerManager />

      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        <b>📖 외부 사이트 연동 가이드</b>
        <ul className="m-0 mt-1 pl-4 list-disc">
          <li>상품 조회: <code className="font-mono">GET {SITE_URL}/api/external/products?category=water</code></li>
          <li>신청 받기: <code className="font-mono">POST {SITE_URL}/api/external/leads</code></li>
          <li>모든 요청은 <code className="font-mono">Authorization: Bearer &lt;apiKey&gt;</code> 헤더 필수</li>
          <li>외부 사이트에서 들어온 lead는 본사 풀(hq_pool)로 분류 → 본사 직영 또는 가까운 협력점에 재배정</li>
        </ul>
      </div>
    </>
  );
}
