import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns product + HQ policy + my partner policy (if logged in as partner_admin)
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  const session = await auth();

  const product = await prisma.product.findUnique({
    where: { productCode: code },
    include: {
      hqPolicy: true,
      partnerPolicies: session?.user?.partnerId
        ? { where: { partnerId: session.user.partnerId } }
        : false,
    },
  });

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const specs = (product.specs as Record<string, string> | null) ?? null;
  const colorStr = specs?.["색상"];
  const colorOptions = colorStr ? colorStr.split(",").map(s => s.trim()).filter(Boolean) : [];

  return NextResponse.json({
    product: {
      productCode: product.productCode,
      category: product.category,
      name: product.name,
      modelName: product.modelName,
      rentalPrice: product.rentalPrice,
      cardDiscountPrice: product.cardDiscountPrice,
      contractPeriod: product.contractPeriod,
      managementType: product.managementType,
      isFeatured: product.isFeatured,
      status: product.status,
      priceMatrix: (product.priceMatrix as unknown) ?? [],
      colorOptions,
    },
    hqPolicy: product.hqPolicy
      ? {
          baseCommission: product.hqPolicy.baseCommission,
          monthIncentive: product.hqPolicy.monthIncentive,
          refundLimitRatio: product.hqPolicy.refundLimitRatio,
          installSubsidy: product.hqPolicy.installSubsidy,
        }
      : null,
    myPartnerPolicy: product.partnerPolicies?.[0]
      ? {
          giftAmount: product.partnerPolicies[0].giftAmount,
          giftLabel: product.partnerPolicies[0].giftLabel,
          installAmount: product.partnerPolicies[0].installAmount,
        }
      : null,
  });
}
