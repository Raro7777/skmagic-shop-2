import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";
import { pickRepresentativeHqPolicy } from "@/lib/hqPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH partner policy for a single product (current user's partner)
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
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
    include: { hqPolicies: true },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const repPolicy = pickRepresentativeHqPolicy(product);
  if (!repPolicy) {
    return NextResponse.json({ error: "본사 정책 미설정 — 환원 불가" }, { status: 400 });
  }

  const giftAmount = Math.max(0, Math.floor(b.giftAmount ?? 0));
  const installAmount = Math.max(0, Math.floor(b.installAmount ?? 0));
  const used = giftAmount + installAmount;
  const baseCommission = repPolicy.baseCommission + repPolicy.monthIncentive;
  const limit = Math.floor(baseCommission * repPolicy.refundLimitRatio);

  if (used > limit) {
    return NextResponse.json(
      { error: `한도 초과: ${used.toLocaleString("ko-KR")}원 > ${limit.toLocaleString("ko-KR")}원 (수수료의 ⅔). 본사 승인 필요.` },
      { status: 400 }
    );
  }

  const policy = await prisma.partnerPolicy.upsert({
    where: { partnerId_productId: { partnerId: eff.partnerId, productId: product.id } },
    update: {
      giftAmount,
      giftLabel: b.giftLabel?.slice(0, 64) ?? null,
      installAmount,
    },
    create: {
      partnerId: eff.partnerId,
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
