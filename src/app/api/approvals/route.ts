import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — HQ-only list of approval requests, default to pending only
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";

  const rows = await prisma.approvalRequest.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { partner: true },
  });

  return NextResponse.json({
    approvals: rows.map(r => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      status: r.status,
      partnerCode: r.partnerId,
      partnerName: r.partner?.partnerName ?? null,
      productCode: r.productCode,
      proposedBaseCommission: r.proposedBaseCommission,
      proposedMonthIncentive: r.proposedMonthIncentive,
      settlementId: r.settlementId,
      reason: r.reason,
      requestedByEmail: r.requestedByEmail,
      applicationData: r.applicationData,
      reviewedById: r.reviewedById,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt.toISOString(),
      ageHours: Math.floor((Date.now() - r.createdAt.getTime()) / 3_600_000),
    })),
  });
}
