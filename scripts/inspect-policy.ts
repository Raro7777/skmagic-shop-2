import { prisma } from "../src/lib/prisma";

async function main() {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: {
      productCode: true, name: true, modelName: true, category: true,
      rentalPrice: true, cardDiscountPrice: true, contractPeriod: true,
      managementType: true, priceMatrix: true,
      hqPolicy: { select: { baseCommission: true, monthIncentive: true, installSubsidy: true, refundLimitRatio: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: 8,
  });
  for (const p of products) {
    console.log("─".repeat(80));
    console.log(`[${p.productCode}] ${p.name} (${p.modelName}) · ${p.managementType} · 기본 ${p.contractPeriod}개월`);
    console.log(`  rentalPrice=₩${p.rentalPrice.toLocaleString()}  cardDiscount=${p.cardDiscountPrice}`);
    if (p.hqPolicy) {
      console.log(`  hqPolicy: base=₩${p.hqPolicy.baseCommission.toLocaleString()}  incent=₩${p.hqPolicy.monthIncentive.toLocaleString()}  install=₩${p.hqPolicy.installSubsidy.toLocaleString()}`);
    } else {
      console.log("  hqPolicy: (없음)");
    }
    const pm = p.priceMatrix as Array<Record<string, unknown>> | null;
    if (pm && Array.isArray(pm)) {
      console.log(`  priceMatrix: ${pm.length}개 옵션`);
      pm.slice(0, 8).forEach((opt, i) => {
        console.log(`    [${i}] ${JSON.stringify(opt)}`);
      });
    } else {
      console.log("  priceMatrix: (비어있음)");
    }
  }
  console.log("─".repeat(80));
  console.log(`총 active 상품: ${products.length}개 (위는 최대 8개만 표시)`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
