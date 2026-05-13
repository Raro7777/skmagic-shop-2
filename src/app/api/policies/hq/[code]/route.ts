import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH HqPolicy for a single (productCode, mode, contractPeriod) option.
 *
 *   body.mode + body.contractPeriod 로 옵션 식별 (필수).
 *   생략 시 product.managementType + product.contractPeriod 매칭 옵션을 대상으로 함 (호환성).
 */
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
    mode: string;
    contractPeriod: number;
    visitInterval: string | null;
    baseCommission: number;
    monthIncentive: number;
    refundLimitRatio: number;
    installSubsidy: number;
  }>;

  const product = await prisma.product.findUnique({
    where: { productCode: code },
    include: { hqPolicies: true },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // 옵션 식별 — body 우선, 없으면 대표 옵션 fallback
  const fallbackMode = product.managementType.includes("자가") || product.managementType.includes("셀프") ? "셀프형" : "방문형";
  const mode = b.mode ?? fallbackMode;
  const contractPeriod = b.contractPeriod ?? product.contractPeriod;

  const existing = product.hqPolicies.find(h => h.mode === mode && h.contractPeriod === contractPeriod);

  const baseCommission =
    b.baseCommission != null ? Math.max(0, Math.floor(b.baseCommission)) : existing?.baseCommission ?? 0;
  const monthIncentive =
    b.monthIncentive != null ? Math.max(0, Math.floor(b.monthIncentive)) : existing?.monthIncentive ?? 0;
  const installSubsidy =
    b.installSubsidy != null ? Math.max(0, Math.floor(b.installSubsidy)) : existing?.installSubsidy ?? 30000;
  const refundLimitRatio =
    b.refundLimitRatio != null
      ? Math.max(0, Math.min(1, b.refundLimitRatio))
      : existing?.refundLimitRatio ?? 0.6667;

  if (baseCommission === 0) {
    return NextResponse.json({ error: "본사 기본 수수료는 0원 이상이어야 합니다." }, { status: 400 });
  }

  const policy = await prisma.hqPolicy.upsert({
    where: { productId_mode_contractPeriod: { productId: product.id, mode, contractPeriod } },
    update: { baseCommission, monthIncentive, installSubsidy, refundLimitRatio, visitInterval: b.visitInterval ?? existing?.visitInterval ?? null },
    create: {
      productId: product.id,
      mode,
      contractPeriod,
      visitInterval: b.visitInterval ?? null,
      baseCommission,
      monthIncentive,
      installSubsidy,
      refundLimitRatio,
    },
  });

  return NextResponse.json({
    ok: true,
    policy: {
      mode: policy.mode,
      contractPeriod: policy.contractPeriod,
      visitInterval: policy.visitInterval,
      baseCommission: policy.baseCommission,
      monthIncentive: policy.monthIncentive,
      installSubsidy: policy.installSubsidy,
      refundLimitRatio: policy.refundLimitRatio,
    },
  });
}
