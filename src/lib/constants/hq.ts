/**
 * 본사(렌트왕) 운영 채널 상수.
 *
 * 여기서 일괄 관리하여 전화번호/시간 변경 시 한 곳만 고치면 된다.
 */

export const HQ_HOTLINE = "1600-2434";
export const HQ_HOTLINE_HOURS = "평일 09:00–22:00";
export const HQ_HOTLINE_TEL = `tel:${HQ_HOTLINE.replace(/[^\d+]/g, "")}`;

/** SK매직 본사 고객센터 (FAQ/A/S 안내 — 우리 운영 채널 아님) */
export const SK_MAGIC_HOTLINE = "1588-1588";
