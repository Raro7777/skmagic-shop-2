/**
 * 본문 이미지 일괄 재다운로드.
 *  - sourceUrl 기반 매칭 — 기존에 다운로드된 sourceUrl 은 skip (재크롤 룰과 동일)
 *  - 새 contentImageUrls (CrawledProduct.rawData 최신본) 가 있으면 신규 다운로드
 *  - 또는 ?force=true 로 전체 삭제 + 재다운로드 모드
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { downloadMany } from "@/lib/blobUploader";
import { flagAnomalousContentImages } from "@/lib/crawler/runner";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  const product = await prisma.product.findUnique({
    where: { productCode: code },
    select: { id: true, productCode: true },
  });
  if (!product) return NextResponse.json({ error: "product not found" }, { status: 404 });

  // 최신 CrawledProduct 에서 sourceUrls 추출 (가장 최근 crawl 결과)
  const recent = await prisma.crawledProduct.findMany({
    where: { productCode: code },
  });
  recent.sort((a, b) => b.crawledAt.getTime() - a.crawledAt.getTime());
  const latest = recent[0];
  if (!latest) return NextResponse.json({ error: "no crawl record" }, { status: 400 });

  const raw = latest.rawData as Record<string, unknown> | null;
  const sourceUrls = Array.isArray(raw?.contentImageUrls)
    ? (raw!.contentImageUrls as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  if (sourceUrls.length === 0) {
    return NextResponse.json({ error: "최근 크롤에 contentImageUrls 가 없습니다." }, { status: 400 });
  }

  let removed = 0;
  if (force) {
    const existing = await prisma.productContentImage.findMany({
      where: { productId: product.id },
      select: { id: true, url: true },
    });
    for (const e of existing) { try { await del(e.url); } catch { /* noop */ } }
    const r = await prisma.productContentImage.deleteMany({ where: { productId: product.id } });
    removed = r.count;
  }

  const existing = await prisma.productContentImage.findMany({
    where: { productId: product.id },
    select: { sourceUrl: true },
  });
  const existingSet = new Set(existing.map(e => e.sourceUrl));
  const toFetch = sourceUrls.filter(u => !existingSet.has(u)).slice(0, 30);

  if (toFetch.length === 0) {
    return NextResponse.json({ ok: true, removed, attempted: 0, stored: 0, failed: 0, skippedExisting: sourceUrls.length });
  }

  const items = toFetch.map((sourceUrl, i) => ({
    sourceUrl,
    pathname: `products/${code}/content-${Date.now()}-${i}`,
  }));
  const results = await downloadMany(items, 5);
  const orderBase = existing.length;
  const rows: Array<{ productId: string; url: string; sourceUrl: string; order: number; sizeBytes: number; width: number | null; height: number | null; status: string }> = [];
  let stored = 0, failed = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.result) {
      stored++;
      rows.push({
        productId: product.id,
        url: r.result.url,
        sourceUrl: r.sourceUrl,
        order: orderBase + i,
        sizeBytes: r.result.sizeBytes,
        width: r.result.width,
        height: r.result.height,
        status: "active",
      });
    } else {
      failed++;
    }
  }
  if (rows.length > 0) await prisma.productContentImage.createMany({ data: rows });

  // 비정형 크기 자동 마킹
  const { flagged } = await flagAnomalousContentImages(product.id);

  return NextResponse.json({
    ok: true,
    removed,
    attempted: toFetch.length,
    stored,
    failed,
    skippedExisting: sourceUrls.length - toFetch.length,
    flaggedAnomalous: flagged,
  });
}
