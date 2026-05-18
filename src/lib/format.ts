/**
 * 가격/숫자 포맷 헬퍼.
 *
 * 화면 전반에서 동일한 표기 규칙(천단위 콤마 + "원" 접미)을 유지하기 위한 단일 출처.
 */

/** 천단위 콤마 (ko-KR). null/undefined 은 em-dash 로. */
export function fmtKr(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}

/** 월 가격: "월 12,900원". null/undefined 은 "—". */
export function formatMonthly(n: number | null | undefined): string {
  return n == null ? "—" : `월 ${n.toLocaleString("ko-KR")}원`;
}

/** 원화 가격: "12,900원". */
export function formatKrw(n: number | null | undefined): string {
  return n == null ? "—" : `${n.toLocaleString("ko-KR")}원`;
}
