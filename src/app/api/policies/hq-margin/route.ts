import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 티어별 본사 마진 기본값 — HQ 콘솔 일괄 편집.
 *   GET: 4개 티어 row 반환
 *   PATCH: body = { tier, marginType, marginAmount, marginPercent }
 */
const VALID_TIERS = ["basic", "standard", "premium", "enterprise"] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.hqMarginByTier.findMany({ orderBy: { tier: "asc" } });
  return NextResponse.json({ tiers: rows });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ tier: string; marginType: "fixed" | "percent"; marginAmount: number; marginPercent: number }>;
  if (!b.tier || !(VALID_TIERS as readonly string[]).includes(b.tier)) {
    return NextResponse.json({ error: "유효하지 않은 tier" }, { status: 400 });
  }
  if (b.marginType !== "fixed" && b.marginType !== "percent") {
    return NextResponse.json({ error: "marginType 은 fixed 또는 percent" }, { status: 400 });
  }

  const marginAmount = Math.max(0, Math.floor(b.marginAmount ?? 0));
  const marginPercent = Math.max(0, Math.min(1, b.marginPercent ?? 0));

  const updated = await prisma.hqMarginByTier.upsert({
    where: { tier: b.tier },
    update: { marginType: b.marginType, marginAmount, marginPercent },
    create: { tier: b.tier, marginType: b.marginType, marginAmount, marginPercent },
  });
  return NextResponse.json({ ok: true, tier: updated });
}
