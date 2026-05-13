import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/policies/partner — 자기 협력점의 PartnerPolicy 목록 (모든 active product 포함, hqPolicy + 본인 정책 join)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "partner_admin" || !session.user.partnerId) {
    return NextResponse.json({ error: "Forbidden — 협력점 관리자만 조회 가능" }, { status: 403 });
  }

  const partnerId = session.user.partnerId;

  const products = await prisma.product.findMany({
    where: { status: "active" },
    include: {
      hqPolicy: true,
      partnerPolicies: { where: { partnerId } },
    },
    orderBy: [{ category: "asc" }, { rentalPrice: "desc" }],
  });

  return NextResponse.json({
    products: products.map(p => {
      const myPolicy = p.partnerPolicies[0] ?? null;
      return {
        productCode: p.productCode,
        category: p.category,
        name: p.name,
        modelName: p.modelName,
        rentalPrice: p.rentalPrice,
        cardDiscountPrice: p.cardDiscountPrice,
        contractPeriod: p.contractPeriod,
        managementType: p.managementType,
        hqPolicy: p.hqPolicy
          ? {
              baseCommission: p.hqPolicy.baseCommission,
              monthIncentive: p.hqPolicy.monthIncentive,
              refundLimitRatio: p.hqPolicy.refundLimitRatio,
              installSubsidy: p.hqPolicy.installSubsidy,
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
