/**
 * DELETE /api/leads/[id]/documents/[docId] — 신청서 문서 삭제
 *
 * 권한 흐름: leads/[id]/documents 와 동일 (본인 스코프 lead 만).
 * Blob 자체는 남겨두고 DB row 만 제거 (감사용 — 운영 결정에 따라 추후 cleanup job).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLeadById } from "@/lib/leadStore";
import type { ActorRole } from "@/lib/leadStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate(id: string) {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = session.user.role;
  let actorRole: ActorRole;
  if (role === "hq") actorRole = "hq";
  else if (role === "partner_admin") actorRole = "partner_admin";
  else if (role === "seller") actorRole = "seller";
  else return { err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  const lead = await getLeadById(id);
  if (!lead) return { err: NextResponse.json({ error: "Lead not found" }, { status: 404 }) };

  if (actorRole === "partner_admin" && lead.partnerId !== session.user.partnerId) {
    return { err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (actorRole === "seller") {
    const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller || lead.sellerId !== seller.id) return { err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actorRole, actorId: session.user.id ?? null };
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await ctx.params;
  const g = await gate(id);
  if ("err" in g) return g.err;

  const doc = await prisma.enrollmentDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.leadId !== id) return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });

  await prisma.enrollmentDocument.delete({ where: { id: docId } });
  return NextResponse.json({ ok: true });
}
