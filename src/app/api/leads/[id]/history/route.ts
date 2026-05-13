import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLeadById, getStatusHistory } from "@/lib/leadStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const role = session.user.role;
  if (role === "partner_admin" && lead.partnerId !== session.user.partnerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "seller") {
    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!seller || lead.sellerId !== seller.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const history = await getStatusHistory(id);
  return NextResponse.json({ history });
}
