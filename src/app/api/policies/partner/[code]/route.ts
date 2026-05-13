import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";
import { pickMinCommissionHqPolicy } from "@/lib/hqPolicy";
import { computeHqMargin } from "@/lib/marginFlow";

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

  const b = body as Partial<{
    giftAmount: number;
    giftLabel: string;
    installAmount: number;
    sellerMarginAmount: number | null;
    sellerMarginPercent: number | null;
  }>;

  const [product, partner, tierMargins] = await Promise.all([
    prisma.product.findUnique({ where: { productCode: code }, include: { hqPolicies: true } }),
    prisma.partner.findUnique({ where: { partnerCode: eff.partnerId }, select: { tier: true } }),
    prisma.hqMarginByTier.findMany(),
  ]);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  // 한도 산정용 최소 수수료 옵션 + 본사마진 차감 후 partnerCommission 기준 한도
  const minPolicy = pickMinCommissionHqPolicy(product);
  if (!minPolicy) {
    return NextResponse.json({ error: "본사 정책 미설정 — 환원 불가" }, { status: 400 });
  }

  const tier = partner?.tier ?? "basic";
  const tierMarginRow = tierMargins.find(t => t.tier === tier);
  const tierMargin = tierMarginRow
    ? { type: tierMarginRow.marginType as "fixed" | "percent", amount: tierMarginRow.marginAmount, percent: tierMarginRow.marginPercent }
    : null;
  const minCommission = minPolicy.baseCommission + minPolicy.monthIncentive;
  const hqMargin = computeHqMargin(minCommission, minPolicy, tierMargin);
  const partnerCommission = minCommission - hqMargin;
  const limit = Math.floor(partnerCommission * minPolicy.refundLimitRatio);

  const giftAmount = Math.max(0, Math.floor(b.giftAmount ?? 0));
  const installAmount = Math.max(0, Math.floor(b.installAmount ?? 0));
  const used = giftAmount + installAmount;

  if (used > limit) {
    return NextResponse.json(
      { error: `한도 초과: ${used.toLocaleString("ko-KR")}원 > ${limit.toLocaleString("ko-KR")}원 (최소 수수료 옵션 ${minPolicy.mode} ${minPolicy.contractPeriod}개월 영업점수수료 기준 ⅔). 본사 승인 필요.` },
      { status: 400 }
    );
  }

  // 영업자 마진 override — null 또는 명시 안되면 기본값(Partner.sellerMargin*) 사용
  const sellerMarginAmount = "sellerMarginAmount" in b
    ? (b.sellerMarginAmount == null ? null : Math.max(0, Math.floor(b.sellerMarginAmount)))
    : undefined;
  const sellerMarginPercent = "sellerMarginPercent" in b
    ? (b.sellerMarginPercent == null ? null : Math.max(0, Math.min(1, b.sellerMarginPercent)))
    : undefined;

  const policy = await prisma.partnerPolicy.upsert({
    where: { partnerId_productId: { partnerId: eff.partnerId, productId: product.id } },
    update: {
      giftAmount,
      giftLabel: b.giftLabel?.slice(0, 64) ?? null,
      installAmount,
      ...(sellerMarginAmount !== undefined && { sellerMarginAmount }),
      ...(sellerMarginPercent !== undefined && { sellerMarginPercent }),
    },
    create: {
      partnerId: eff.partnerId,
      productId: product.id,
      giftAmount,
      giftLabel: b.giftLabel?.slice(0, 64) ?? null,
      installAmount,
      sellerMarginAmount: sellerMarginAmount ?? null,
      sellerMarginPercent: sellerMarginPercent ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    policy: {
      giftAmount: policy.giftAmount,
      giftLabel: policy.giftLabel,
      installAmount: policy.installAmount,
      sellerMarginAmount: policy.sellerMarginAmount,
      sellerMarginPercent: policy.sellerMarginPercent,
    },
  });
}
