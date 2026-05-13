import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { pickRepresentativeHqPolicy } from "@/lib/hqPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List of all products + their HqPolicy options (HQ admin view).
//
// 응답:
//   products[].representativePolicy — 대표(매니저먼트타입+contractPeriod 매칭) 단일 정책.
//                                     기존 단일 hqPolicy 자리에 호환 형태로 노출.
//   products[].options              — 전체 (mode, contractPeriod) 매트릭스. 옵션별 편집용.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const products = await prisma.product.findMany({
    where: { status: "active" },
    include: {
      hqPolicies: { orderBy: [{ mode: "asc" }, { contractPeriod: "asc" }] },
    },
    orderBy: [{ category: "asc" }, { rentalPrice: "desc" }],
  });

  return NextResponse.json({
    products: products.map(p => {
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
              mode: rep.mode,
              contractPeriod: rep.contractPeriod,
              baseCommission: rep.baseCommission,
              monthIncentive: rep.monthIncentive,
              refundLimitRatio: rep.refundLimitRatio,
              installSubsidy: rep.installSubsidy,
            }
          : null,
        options: p.hqPolicies.map(h => ({
          mode: h.mode,
          contractPeriod: h.contractPeriod,
          visitInterval: h.visitInterval,
          baseCommission: h.baseCommission,
          monthIncentive: h.monthIncentive,
          refundLimitRatio: h.refundLimitRatio,
          installSubsidy: h.installSubsidy,
          marginType: h.marginType,
          marginAmount: h.marginAmount,
          marginPercent: h.marginPercent,
        })),
      };
    }),
  });
}
