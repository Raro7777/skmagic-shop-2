import { prisma } from "../src/lib/prisma";

async function main() {
  const codes = ["ACL15C1ASKWH", "ACL20C1ASKWH", "ACL25C1ASKCE"];
  for (const code of codes) {
    const p = await prisma.product.findUnique({
      where: { productCode: code },
      select: { productCode: true, name: true, priceMatrix: true },
    });
    if (!p) { console.log(`${code} not found`); continue; }
    console.log(`\n=== ${p.productCode} (${p.name}) ===`);
    const matrix = (p.priceMatrix as unknown as Array<Record<string, unknown>>) ?? [];
    for (const o of matrix) {
      console.log(`  mode=${o.mode} contract=${o.contractPeriod} visit=${o.visitInterval} rent=${o.rentalPrice} card=${o.cardDiscountPrice} base=${o.baseCommission}`);
    }
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
