/**
 * Vercel Cron 자동 호출 엔드포인트.
 *  - vercel.json: { path: "/api/cron/crawl/skmagic", schedule: "0 19 * * *" }
 *  - Vercel이 자동 헤더 `Authorization: Bearer <CRON_SECRET>` 부여
 *  - 또는 수동 트리거 시 동일 헤더 필요
 *
 * 작동:
 *  1. CRON_SECRET 검증
 *  2. runCrawl({ sourceSlug: "skmagic" })
 *  3. 결과 + 변경 감지 카운트 반환 (Vercel cron 로그에 노출)
 */
import { NextResponse } from "next/server";
import { runCrawl } from "@/lib/crawler/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 최대 5분 — 크롤 + 상세 페이지 60+ 호출

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  // Vercel Cron 인증 (CRON_SECRET 환경변수 필요)
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET 환경변수 미설정 — 운영자에게 문의" },
      { status: 500 },
    );
  }
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await runCrawl({
      sourceSlug: "skmagic",
      triggeredById: null,
    });
    return NextResponse.json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      ...result,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
