/**
 * 네이버 검색광고 전환 추적 헬퍼.
 *
 *   wa 값이 설정된 협력점 페이지에서만 wcs.trans 호출 (다른 협력점은 no-op).
 *   tracker 실패 시에도 호출자 흐름 영향 X (try/catch).
 *   중복 호출 방지는 호출자가 책임 (예: lead success 1회, 신청 버튼 클릭 1회 등).
 *
 * 사용:
 *   import { naverTrans } from "@/lib/naverWcsTrans";
 *   naverTrans("lead");      // 상담신청 완료
 *   naverTrans("custom001"); // 전화 버튼 클릭
 *   naverTrans("custom002"); // 카톡 버튼 클릭
 *   naverTrans("custom003"); // 신청 버튼 클릭 (모달 열기)
 */
export type NaverConvType = "lead" | "custom001" | "custom002" | "custom003";

export function naverTrans(type: NaverConvType): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    wcs?: { trans?: (conv: { type: string }) => void };
    wcs_add?: { wa?: string };
  };
  if (!w.wcs?.trans || !w.wcs_add?.wa) return;
  try {
    w.wcs.trans({ type });
  } catch {
    // tracker fail — silently ignore
  }
}
