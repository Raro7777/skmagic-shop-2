import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HQ_VIEW_COOKIE } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET settlements — partner sees own, hq sees all (또는 협력점 콘솔에서 호출 시 hq_view_partner 로 scope)
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
  } else if (role === "hq") {
    const c = await cookies();
    const cookieVal = c.get(HQ_VIEW_COOKIE)?.value;
    const referer = req.headers.get("referer") ?? "";
    if (cookieVal && referer.includes("/admin/franchise")) {
      where.partnerId = cookieVal;
    }
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
