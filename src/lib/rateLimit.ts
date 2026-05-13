/**
 * 매우 가벼운 in-memory rate limiter.
 *
 * 한계:
 *  - Serverless에서는 인스턴스마다 메모리 분리 → 정확하지 않음
 *  - 정확한 분산 rate limit이 필요하면 Vercel KV / Upstash Redis로 교체
 *
 * 현재 목적: 단일 인스턴스 기준 명백한 봇 트래픽 차단(스팸 lead 폭증 방지) +
 * 로그인 폭격을 표면적으로 늦춤.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * @returns true if the request is allowed; false if rate-limited.
 */
export function rateLimit(
  req: Request,
  bucketName: string,
  opts: { windowMs: number; max: number },
): { ok: true } | { ok: false; retryAfterSec: number } {
  const ip = clientIp(req);
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  const cur = buckets.get(key);

  if (!cur || cur.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  if (cur.count >= opts.max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }

  cur.count++;
  return { ok: true };
}

// Periodic GC — 메모리 누수 방지 (10분마다 만료 항목 정리)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets.entries()) {
      if (v.resetAt < now) buckets.delete(k);
    }
  }, 10 * 60 * 1000).unref?.();
}
