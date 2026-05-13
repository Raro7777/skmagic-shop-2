import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TIER_LIST, type Tier } from "@/lib/tier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/partners/[code] — HQ 전용
// actions: setTier | close | reopen
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { code } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ action: "setTier" | "close" | "reopen"; tier: Tier }>;
  if (!b.action) return NextResponse.json({ error: "action 필수" }, { status: 400 });

  const partner = await prisma.partner.findUnique({ where: { partnerCode: code } });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  if (b.action === "setTier") {
    if (!b.tier || !TIER_LIST.includes(b.tier)) {
      return NextResponse.json({ error: "유효하지 않은 tier" }, { status: 400 });
    }
    if (partner.status === "closed") {
      return NextResponse.json({ error: "퇴점 협력점의 tier는 변경할 수 없습니다. 먼저 재활성화하세요." }, { status: 400 });
    }
    await prisma.partner.update({
      where: { partnerCode: code },
      data: { tier: b.tier },
    });
    return NextResponse.json({ ok: true, tier: b.tier });
  }

  if (b.action === "close") {
    if (partner.status === "closed") {
      return NextResponse.json({ error: "이미 퇴점 처리된 협력점입니다." }, { status: 400 });
    }

    // 트랜잭션 — 룰북 14
    //   1. partner.status = "closed", closedAt = now
    //   2. 진행중 lead → 본사 풀(hq_pool)로 이전 + LeadStatusLog 기록 (종료/완료 상태 제외)
    //   3. seller status="inactive"
    //   4. banner status="draft"
    const result = await prisma.$transaction(async tx => {
      const activeLeads = await tx.lead.findMany({
        where: {
          partnerId: code,
          status: { notIn: ["consult_closed", "install_cancel", "settle_done"] },
        },
        select: { id: true, status: true, partnerId: true },
      });
      for (const lead of activeLeads) {
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            partnerId: null,
            sellerId: null,
            ownerType: "hq_pool",
          },
        });
        await tx.leadStatusLog.create({
          data: {
            leadId: lead.id,
            previousStatus: lead.status,
            newStatus: lead.status,
            changedById: session.user.id,
            memo: `[퇴점 인계] 협력점 ${code} 퇴점으로 본사 풀로 이전`,
          },
        });
      }

      const sellerUpdate = await tx.seller.updateMany({
        where: { partnerId: code, status: "active" },
        data: { status: "inactive" },
      });

      const bannerUpdate = await tx.banner.updateMany({
        where: { partnerId: code, status: "active" },
        data: { status: "draft" },
      });

      await tx.partner.update({
        where: { partnerCode: code },
        data: { status: "closed", closedAt: new Date() },
      });

      return {
        handedOverLeads: activeLeads.length,
        deactivatedSellers: sellerUpdate.count,
        deactivatedBanners: bannerUpdate.count,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  }

  if (b.action === "reopen") {
    if (partner.status === "active") {
      return NextResponse.json({ error: "이미 활성 상태입니다." }, { status: 400 });
    }
    await prisma.partner.update({
      where: { partnerCode: code },
      data: { status: "active", closedAt: null },
    });
    // 영업자와 배너 재활성화는 협력점 admin이 직접 결정 (자동 복원 안 함 — 안전)
    return NextResponse.json({ ok: true, message: "협력점이 재활성화되었습니다. 영업자/배너는 협력점 admin이 직접 다시 활성화해야 합니다." });
  }

  return NextResponse.json({ error: "유효하지 않은 action" }, { status: 400 });
}
