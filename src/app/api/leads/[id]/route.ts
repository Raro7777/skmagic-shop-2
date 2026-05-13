import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLeadById, viewablePhone } from "@/lib/leadStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Detail endpoint — applies rulebook A3:
//   풀번호 열람 = 담당 배정된 lead AND 상태가 new/going. 그 외는 마스킹.
//   본사(hq)는 항상 풀번호 열람 가능 (+다운로드 권한).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const lead = await getLeadById(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const role = session.user.role;
  const viewerPartnerId = session.user.partnerId;

  // Partner admins can only access their own leads
  if (role === "partner_admin" && lead.partnerId !== viewerPartnerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Sellers can only access leads where they are the assigned seller
  if (role === "seller") {
    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!seller || lead.sellerId !== seller.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // HQ users can always see full phone; partner admins follow A3 rule
  const phone =
    role === "hq"
      ? formatPhone(lead.phoneRaw)
      : viewablePhone(lead, { partnerId: viewerPartnerId });

  const isFullPhone =
    role === "hq" ||
    (lead.ownerType === "partner" &&
      lead.partnerId === viewerPartnerId &&
      (lead.status === "consult_wish" ||
        lead.status === "consult_active" ||
        lead.status === "verify_failed" ||
        lead.status === "verify_revise" ||
        lead.status === "revise_resubmit"));

  return NextResponse.json({
    id: lead.id,
    createdAt: lead.createdAt,
    customerName: lead.customerName,
    phone,
    isFullPhone,
    productInterest: lead.productInterest,
    region: lead.region,
    partnerId: lead.partnerId,
    ownerType: lead.ownerType,
    status: lead.status,
    duplicateStatus: lead.duplicateStatus,
  });
}

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.length !== 11) return p;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
