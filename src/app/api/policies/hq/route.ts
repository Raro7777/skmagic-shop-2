import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List of all products + their HqPolicy (HQ admin view)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const products = await prisma.product.findMany({
    where: { status: "active" },
    include: { hqPolicy: true },
    orderBy: [{ category: "asc" }, { rentalPrice: "desc" }],
  });

  return NextResponse.json({
    products: products.map(p => ({
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
    })),
  });
}
