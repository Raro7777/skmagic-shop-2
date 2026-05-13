/**
 * GET /api/franchise/banner-stats — 협력점별 배너 통계.
 *   응답: 각 배너의 impression / click / ctr.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const grouped = await prisma.bannerEvent.groupBy({
    by: ["bannerId", "eventType"],
    where: { partnerId: eff.partnerId },
    _count: true,
  });

  const stats: Record<string, { impressions: number; clicks: number }> = {};
  for (const g of grouped) {
    if (!stats[g.bannerId]) stats[g.bannerId] = { impressions: 0, clicks: 0 };
    if (g.eventType === "impression") stats[g.bannerId].impressions = g._count;
    else if (g.eventType === "click") stats[g.bannerId].clicks = g._count;
  }
  return NextResponse.json({ stats });
}
