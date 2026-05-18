/**
 * 사이트 URL 단일 출처.
 *
 * 프로덕션 도메인 변경 시 ENV `NEXT_PUBLIC_SITE_URL` 만 갱신.
 * 외부 API 응답, OG meta, robots.txt, sitemap, 영업자 링크 등 공통 사용.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://skmagic-shop.com";
