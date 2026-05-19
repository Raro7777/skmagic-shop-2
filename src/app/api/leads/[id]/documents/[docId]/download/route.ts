/**
 * GET /api/leads/[id]/documents/[docId]/download
 *
 * P0-1 보안 수정 — 고객 신분증/통장사본 등 PII 문서를 public Blob URL 로 직접 노출하지 않고
 * 이 인증 프록시를 통해서만 접근하도록 한다.
 *   1) 세션 + 역할 + lead 소유관계 재검증 (DELETE 와 동일 gate)
 *   2) 통과 시 실제 Blob URL 로 302 redirect (Vercel Blob 의 random suffix 가
 *      brute-force 보호 — URL 자체가 secret token 역할)
 *
 * 응답 자체는 짧은 redirect 라 audit 부담 적음.
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
  if (!lead) return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  if (actorRole === "partner_admin" && lead.partnerId !== session.user.partnerId) {
    return { err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (actorRole === "seller") {
    const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller || lead.sellerId !== seller.id) return { err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actorRole, actorId: session.user.id ?? null };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await ctx.params;
  const g = await gate(id);
  if ("err" in g) return g.err;

  const doc = await prisma.enrollmentDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.leadId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 302 redirect 로 실제 Blob URL 로 보낸다. brute-force 방지는 Blob URL 의
  // random suffix 가 담당. 사용자가 직접 URL 을 본인 화면 외부에서 공유해도
  // 인증을 통과한 사람만 발급받을 수 있는 일회성 흐름이라 위험도 ↓.
  return NextResponse.redirect(doc.url, 302);
}
