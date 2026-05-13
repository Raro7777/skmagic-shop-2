import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";
import { pickMinCommissionHqPolicy } from "@/lib/hqPolicy";
import { computeHqMargin } from "@/lib/marginFlow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/policies/partner — 자기 협력점 정책 목록 + 본사 마진 반영된 영업점수수료(partnerCommission) 노출
export async function GET() {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const partnerId = eff.partnerId;

  const [partner, products, tierMargins] = await Promise.all([
    prisma.partner.findUnique({
      where: { partnerCode: partnerId },
      select: { tier: true, sellerMarginType: true, sellerMarginAmount: true, sellerMarginPercent: true },
    }),
    prisma.product.findMany({
      where: { status: "active" },
      include: {
        hqPolicies: true,
        partnerPolicies: { where: { partnerId } },
      },
      orderBy: [{ category: "asc" }, { rentalPrice: "desc" }],
    }),
    prisma.hqMarginByTier.findMany(),
  ]);

  const tier = partner?.tier ?? "basic";
  const tierMarginRow = tierMargins.find(t => t.tier === tier);
  const tierMargin = tierMarginRow
    ? { type: tierMarginRow.marginType as "fixed" | "percent", amount: tierMarginRow.marginAmount, percent: tierMarginRow.marginPercent }
    : null;

  return NextResponse.json({
    partnerTier: tier,
    sellerMarginDefault: partner
      ? { type: partner.sellerMarginType, amount: partner.sellerMarginAmount, percent: partner.sellerMarginPercent }
      : null,
    products: products.map(p => {
      const myPolicy = p.partnerPolicies[0] ?? null;
      // 한도 산정용 최소 수수료 옵션 (모든 옵션에 환원 동일 적용 → 가장 낮은 옵션 ⅔ 한도)
      const minPolicy = pickMinCommissionHqPolicy(p);
      // 최소 옵션에 대한 본사마진 계산 → partnerCommission = baseCommission - hqMargin
      const baseCommission = minPolicy ? minPolicy.baseCommission + minPolicy.monthIncentive : 0;
      const hqMargin = minPolicy ? computeHqMargin(baseCommission, minPolicy, tierMargin) : 0;
      const partnerCommission = baseCommission - hqMargin;

      return {
        productCode: p.productCode,
        category: p.category,
        name: p.name,
        modelName: p.modelName,
        rentalPrice: p.rentalPrice,
        cardDiscountPrice: p.cardDiscountPrice,
        contractPeriod: p.contractPeriod,
        managementType: p.managementType,
        hqPolicy: minPolicy
          ? {
              baseCommission,            // 본사 수수료 (참고용)
              hqMargin,                  // 본사 마진
              partnerCommission,         // 영업점수수료 ★ 정책 표기 + 환수 기준
              refundLimitRatio: minPolicy.refundLimitRatio,
              installSubsidy: minPolicy.installSubsidy,
              limitOptionMode: minPolicy.mode,
              limitOptionPeriod: minPolicy.contractPeriod,
              optionCount: p.hqPolicies.length,
            }
          : null,
        myPolicy: myPolicy
          ? {
              giftAmount: myPolicy.giftAmount,
              giftLabel: myPolicy.giftLabel,
              installAmount: myPolicy.installAmount,
              sellerMarginAmount: myPolicy.sellerMarginAmount,
              sellerMarginPercent: myPolicy.sellerMarginPercent,
            }
          : null,
      };
    }),
  });
}
