/**
 * 네이버 검색광고 전환 추적 헬퍼.
 *
 *   layout.tsx 의 raw <script> 가 글로벌 함수 (NA_CONV_LEAD/CUSTOM001~003) 정의.
 *   이 헬퍼는 그 글로벌 함수를 호출 — 네이버 진단 도구의 표준 패턴 검사 통과 우선.
 *   글로벌 함수 미정의 시 (wa 값 없는 협력점) 자동 no-op.
 *
 * 사용:
 *   import { naverTrans } from "@/lib/naverWcsTrans";
 *   naverTrans("lead");      // 상담신청 완료
 *   naverTrans("custom001"); // 전화 버튼 클릭
 *   naverTrans("custom002"); // 카톡 버튼 클릭
 *   naverTrans("custom003"); // 신청 버튼 클릭 (모달 열기)
 */
export type NaverConvType = "lead" | "custom001" | "custom002" | "custom003";

const FN_MAP: Record<NaverConvType, string> = {
  lead: "NA_CONV_LEAD",
  custom001: "NA_CONV_CUSTOM001",
  custom002: "NA_CONV_CUSTOM002",
  custom003: "NA_CONV_CUSTOM003",
};

export function naverTrans(type: NaverConvType): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;
  const fnName = FN_MAP[type];
  const fn = w[fnName];
  if (typeof fn !== "function") return; // wa 미설정 협력점은 글로벌 함수 자체가 없음
  try {
    (fn as () => void)();
  } catch {
    // tracker fail — silently ignore
  }
}
