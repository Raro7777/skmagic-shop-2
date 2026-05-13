import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH partner policy for a single product (current user's partner)
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "partner_admin" || !session.user.partnerId) {
    return NextResponse.json({ error: "Forbidden — 협력점 관리자만 수정 가능" }, { status: 403 });
  }

  const { code } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Partial<{ giftAmount: number; giftLabel: string; installAmount: number }>;

  const product = await prisma.product.findUnique({
    where: { productCode: code },
    include: { hqPolicy: true },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (!product.hqPolicy) {
    return NextResponse.json({ error: "본사 정책 미설정 — 환원 불가" }, { status: 400 });
  }

  const giftAmount = Math.max(0, Math.floor(b.giftAmount ?? 0));
  const installAmount = Math.max(0, Math.floor(b.installAmount ?? 0));
  const used = giftAmount + installAmount;
  const baseCommission = product.hqPolicy.baseCommission + product.hqPolicy.monthIncentive;
  const limit = Math.floor(baseCommission * product.hqPolicy.refundLimitRatio);

  if (used > limit) {
    return NextResponse.json(
      { error: `한도 초과: ${used.toLocaleString("ko-KR")}원 > ${limit.toLocaleString("ko-KR")}원 (수수료의 ⅔). 본사 승인 필요.` },
      { status: 400 }
    );
  }

  const policy = await prisma.partnerPolicy.upsert({
    where: { partnerId_productId: { partnerId: session.user.partnerId, productId: product.id } },
    update: {
      giftAmount,
      giftLabel: b.giftLabel?.slice(0, 64) ?? null,
      installAmount,
    },
    create: {
      partnerId: session.user.partnerId,
      productId: product.id,
      giftAmount,
      giftLabel: b.giftLabel?.slice(0, 64) ?? null,
      installAmount,
    },
  });

  return NextResponse.json({
    ok: true,
    policy: {
      giftAmount: policy.giftAmount,
      giftLabel: policy.giftLabel,
      installAmount: policy.installAmount,
    },
  });
}
