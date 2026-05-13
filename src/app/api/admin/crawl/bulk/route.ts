import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { approveCrawledProduct, rejectCrawledProduct } from "@/lib/crawler/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/crawl/bulk — HQ가 여러 CrawledProduct를 한 번에 승인/반려한다.
// body: { ids: string[], action: "approve" | "reject", note?: string }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ ids: string[]; action: "approve" | "reject"; note: string }>;

  if (!Array.isArray(b.ids) || b.ids.length === 0) {
    return NextResponse.json({ error: "ids 비어있음" }, { status: 400 });
  }
  if (b.ids.length > 200) {
    return NextResponse.json({ error: "한 번에 최대 200건까지 가능합니다." }, { status: 400 });
  }
  if (!b.action || !["approve", "reject"].includes(b.action)) {
    return NextResponse.json({ error: "유효하지 않은 action" }, { status: 400 });
  }

  const note = b.note?.slice(0, 256) ?? null;
  let okCount = 0;
  const failures: Array<{ id: string; error: string }> = [];

  // 트랜잭션은 항목마다 별도로 — 한 건 실패가 다른 항목 처리를 막지 않도록.
  for (const id of b.ids) {
    try {
      if (b.action === "approve") {
        await approveCrawledProduct({ crawledId: id, reviewerId: session.user.id, note });
      } else {
        await rejectCrawledProduct({ crawledId: id, reviewerId: session.user.id, note });
      }
      okCount++;
    } catch (e) {
      failures.push({ id, error: e instanceof Error ? e.message : "처리 실패" });
    }
  }

  return NextResponse.json({
    ok: true,
    action: b.action,
    requested: b.ids.length,
    succeeded: okCount,
    failed: failures.length,
    failures,
  });
}
