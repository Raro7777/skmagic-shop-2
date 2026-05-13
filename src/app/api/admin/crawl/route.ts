import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runCrawl } from "@/lib/crawler/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/crawl — HQ triggers a crawl for a given source slug.
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
  const b = body as Partial<{ sourceSlug: string }>;
  if (!b.sourceSlug || typeof b.sourceSlug !== "string") {
    return NextResponse.json({ error: "sourceSlug 누락" }, { status: 400 });
  }

  try {
    const result = await runCrawl({
      sourceSlug: b.sourceSlug,
      triggeredById: session.user.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "크롤 실패" },
      { status: 500 },
    );
  }
}
