import HqPolicyEditor from "@/components/super/HqPolicyEditor";

export const metadata = { title: "기준 정책 · 슈퍼관리자" };

export default function PoliciesPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">기준 판매수수료 정책</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        본사 기본 수수료 + 이번 달 인센티브 + 설치비 보조 — 변경은 모든 협력점에 즉시 반영
      </p>

      <HqPolicyEditor />

      <div className="mt-3 bg-rk-tint-orange text-rk-orange-deep px-3 py-2 rounded text-[13px] leading-[1.6]">
        ⚠ 본사 수수료를 낮추면 일부 협력점이 사은품 환원 한도를 초과할 수 있습니다.
        영향 협력점 수 확인 + 24시간 grace period 알림은 다음 단계에서 추가 예정.
      </div>
    </>
  );
}
