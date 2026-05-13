import { prisma } from "./prisma";

/**
 * 외부 사이트 API 인증 — `Authorization: Bearer <apiKey>` 또는 `?key=<apiKey>`
 * 반환: 매칭된 ApiPartner 또는 null
 *
 * status=disabled 또는 키 없음/잘못된 키 → null.
 */
export async function authenticateApiPartner(req: Request): Promise<{
  id: string;
  slug: string;
  name: string;
  allowedCategories: string[];
  webhookUrl: string | null;
} | null> {
  // 1) Authorization 헤더
  let key: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    key = auth.slice(7).trim();
  }
  // 2) 쿼리 파라미터 (편의 — 정식 운영 시 헤더 권장)
  if (!key) {
    const url = new URL(req.url);
    key = url.searchParams.get("key");
  }
  if (!key) return null;
  if (key.length < 16 || key.length > 128) return null;

  const partner = await prisma.apiPartner.findUnique({ where: { apiKey: key } });
  if (!partner || partner.status !== "active") return null;

  // 사용 통계 비동기 갱신 (응답 지연 X)
  prisma.apiPartner
    .update({ where: { id: partner.id }, data: { lastUsedAt: new Date() } })
    .catch(() => { /* noop */ });

  return {
    id: partner.id,
    slug: partner.slug,
    name: partner.name,
    allowedCategories: partner.allowedCategories,
    webhookUrl: partner.webhookUrl,
  };
}

/** ApiPartner 일관 응답 헤더 */
export function apiHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-cache",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}
