import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 본사 — 후기 승인 / 거절
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const b = body as { action?: "approve" | "reject"; rejectReason?: string };

  if (b.action === "approve") {
    const r = await prisma.review.update({
      where: { id },
      data: {
        approvalStatus: "approved",
        approvedAt: new Date(),
        approvedById: session.user.id ?? null,
        rejectReason: null,
        isVerified: true,
      },
    });
    return NextResponse.json({ ok: true, id: r.id, approvalStatus: r.approvalStatus });
  }
  if (b.action === "reject") {
    const r = await prisma.review.update({
      where: { id },
      data: {
        approvalStatus: "rejected",
        rejectReason: b.rejectReason?.trim().slice(0, 500) || null,
        approvedAt: null,
        approvedById: null,
      },
    });
    return NextResponse.json({ ok: true, id: r.id, approvalStatus: r.approvalStatus });
  }
  return NextResponse.json({ error: "action 은 approve | reject 만 허용" }, { status: 400 });
}
