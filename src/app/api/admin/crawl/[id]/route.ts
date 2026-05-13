import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { approveCrawledProduct, rejectCrawledProduct } from "@/lib/crawler/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/crawl/[id] — HQ approves or rejects a queued CrawledProduct.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ action: "approve" | "reject"; note: string }>;
  if (!b.action || !["approve", "reject"].includes(b.action)) {
    return NextResponse.json({ error: "유효하지 않은 action" }, { status: 400 });
  }

  let imageResult: { contentImagesAttempted: number; contentImagesStored: number; contentImagesFailed: number } | null = null;
  try {
    if (b.action === "approve") {
      imageResult = await approveCrawledProduct({
        crawledId: id,
        reviewerId: session.user.id,
        note: b.note?.slice(0, 256) ?? null,
      });
    } else {
      await rejectCrawledProduct({
        crawledId: id,
        reviewerId: session.user.id,
        note: b.note?.slice(0, 256) ?? null,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "처리 실패" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, images: imageResult });
}
