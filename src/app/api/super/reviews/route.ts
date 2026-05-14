import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 본사 — 후기 큐 (approvalStatus 필터)
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") ?? "pending";

  const rows = await prisma.review.findMany({
    where: { approvalStatus: statusFilter },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { productCode: true, name: true } },
      partner: { select: { partnerCode: true, partnerName: true } },
    },
  });
  return NextResponse.json({
    items: rows.map(r => ({
      id: r.id,
      productCode: r.product?.productCode ?? null,
      productName: r.product?.name ?? null,
      partnerCode: r.partner?.partnerCode ?? null,
      partnerName: r.partner?.partnerName ?? null,
      customerName: r.customerName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      installPhotoUrl: r.installPhotoUrl,
      region: r.region,
      selectedMode: r.selectedMode,
      selectedContractPeriod: r.selectedContractPeriod,
      approvalStatus: r.approvalStatus,
      rejectReason: r.rejectReason,
      submittedByRole: r.submittedByRole,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
