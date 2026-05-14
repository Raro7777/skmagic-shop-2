import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — 특정 lead 의 EnrollmentForm 변경 이력 (timeline) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!["hq", "partner_admin", "seller"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  // 권한 게이트 — 협력점/영업자는 자기 lead 만
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { partnerId: true, sellerId: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (role === "partner_admin" && lead.partnerId !== session.user.partnerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "seller") {
    const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller || seller.id !== lead.sellerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const rows = await prisma.enrollmentFormHistory.findMany({
    where: { leadId: id },
    orderBy: { changedAt: "desc" },
  });

  return NextResponse.json({
    items: rows.map(r => ({
      id: r.id,
      changedAt: r.changedAt.toISOString(),
      changedById: r.changedById,
      changedByRole: r.changedByRole,
      reason: r.reason,
      changeSource: r.changeSource,
      changes: r.changes, // { fieldName: { from, to } }
    })),
  });
}
