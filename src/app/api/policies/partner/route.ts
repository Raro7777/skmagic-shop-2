import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";
import { pickRepresentativeHqPolicy } from "@/lib/hqPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/policies/partner — 자기 협력점의 PartnerPolicy 목록 (모든 active product 포함, hqPolicy + 본인 정책 join)
export async function GET() {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const partnerId = eff.partnerId;

  const products = await prisma.product.findMany({
    where: { status: "active" },
    include: {
      hqPolicies: true,
      partnerPolicies: { where: { partnerId } },
    },
    orderBy: [{ category: "asc" }, { rentalPrice: "desc" }],
  });

  return NextResponse.json({
    products: products.map(p => {
      const myPolicy = p.partnerPolicies[0] ?? null;
      const rep = pickRepresentativeHqPolicy(p);
      return {
        productCode: p.productCode,
        category: p.category,
        name: p.name,
        modelName: p.modelName,
        rentalPrice: p.rentalPrice,
        cardDiscountPrice: p.cardDiscountPrice,
        contractPeriod: p.contractPeriod,
        managementType: p.managementType,
        hqPolicy: rep
          ? {
              baseCommission: rep.baseCommission,
              monthIncentive: rep.monthIncentive,
              refundLimitRatio: rep.refundLimitRatio,
              installSubsidy: rep.installSubsidy,
            }
          : null,
        myPolicy: myPolicy
          ? {
              giftAmount: myPolicy.giftAmount,
              giftLabel: myPolicy.giftLabel,
              installAmount: myPolicy.installAmount,
            }
          : null,
      };
    }),
  });
}
