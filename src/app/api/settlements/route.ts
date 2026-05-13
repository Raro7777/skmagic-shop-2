import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET settlements — partner sees own, hq sees all
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const periodMonth = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const role = session.user.role;

  const where: { periodMonth: string; partnerId?: string } = { periodMonth };
  if (role === "partner_admin") {
    if (!session.user.partnerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    where.partnerId = session.user.partnerId;
  }

  const rows = await prisma.settlement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const totalPayout = rows
    .filter(r => r.status !== "cancelled")
    .reduce((sum, r) => sum + r.netPayout, 0);
  const activeCount = rows.filter(r => r.status !== "cancelled").length;

  return NextResponse.json({
    settlements: rows.map(r => ({
      id: r.id,
      leadId: r.leadId,
      partnerId: r.partnerId,
      productCode: r.productCode,
      productName: r.productName,
      baseCommission: r.baseCommission,
      giftReturned: r.giftReturned,
      installReturned: r.installReturned,
      rentalSupportReturned: r.rentalSupportReturned,
      netPayout: r.netPayout,
      status: r.status,
      periodMonth: r.periodMonth,
      createdAt: r.createdAt.toISOString(),
    })),
    summary: { count: activeCount, totalPayout, periodMonth },
  });
}
