import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: { productCode: true, name: true, category: true, priceMatrix: true },
  });
  let withHalf = 0;
  let withRival = 0;
  for (const p of products) {
    const matrix = (p.priceMatrix as unknown as Array<{
      mode?: string | null;
      contractPeriod?: number;
      rentalPrice?: number | null;
      cardDiscountPrice?: number | null;
      rivalCompensationPrice?: number | null;
      rivalCompensationHalfPriceMonths?: number | null;
    }> | null) ?? [];
    const hasRival = matrix.some(o => (o.rivalCompensationPrice ?? 0) > 0);
    const hasHalf = matrix.some(o => (o.rivalCompensationHalfPriceMonths ?? 0) > 0);
    if (hasRival) withRival++;
    if (hasHalf) {
      withHalf++;
      const opt = matrix.find(o => (o.rivalCompensationHalfPriceMonths ?? 0) > 0)!;
      console.log(`HALF | ${p.productCode} | ${p.category} | ${p.name}`);
      console.log(`     opt: mode=${opt.mode} cp=${opt.contractPeriod} rental=${opt.rentalPrice} card=${opt.cardDiscountPrice} rival=${opt.rivalCompensationPrice} halfMonths=${opt.rivalCompensationHalfPriceMonths}`);
    }
  }
  console.log(`\nactive: ${products.length}, with rival: ${withRival}, with half-price: ${withHalf}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
