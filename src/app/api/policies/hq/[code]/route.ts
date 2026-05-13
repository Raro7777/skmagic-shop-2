import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH HqPolicy for a single product (HQ-only)
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden — 본사 관리자만 수정 가능" }, { status: 403 });
  }

  const { code } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Partial<{
    baseCommission: number;
    monthIncentive: number;
    refundLimitRatio: number;
    installSubsidy: number;
  }>;

  const product = await prisma.product.findUnique({
    where: { productCode: code },
    include: { hqPolicy: true },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Validate
  const baseCommission =
    b.baseCommission != null ? Math.max(0, Math.floor(b.baseCommission)) : product.hqPolicy?.baseCommission ?? 0;
  const monthIncentive =
    b.monthIncentive != null ? Math.max(0, Math.floor(b.monthIncentive)) : product.hqPolicy?.monthIncentive ?? 0;
  const installSubsidy =
    b.installSubsidy != null ? Math.max(0, Math.floor(b.installSubsidy)) : product.hqPolicy?.installSubsidy ?? 30000;
  const refundLimitRatio =
    b.refundLimitRatio != null
      ? Math.max(0, Math.min(1, b.refundLimitRatio))
      : product.hqPolicy?.refundLimitRatio ?? 0.6667;

  if (baseCommission === 0) {
    return NextResponse.json({ error: "본사 기본 수수료는 0원 이상이어야 합니다." }, { status: 400 });
  }

  const policy = await prisma.hqPolicy.upsert({
    where: { productId: product.id },
    update: { baseCommission, monthIncentive, installSubsidy, refundLimitRatio },
    create: {
      productId: product.id,
      baseCommission,
      monthIncentive,
      installSubsidy,
      refundLimitRatio,
    },
  });

  return NextResponse.json({
    ok: true,
    policy: {
      baseCommission: policy.baseCommission,
      monthIncentive: policy.monthIncentive,
      installSubsidy: policy.installSubsidy,
      refundLimitRatio: policy.refundLimitRatio,
    },
  });
}
