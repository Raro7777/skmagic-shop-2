import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const p = await prisma.product.findUnique({
    where: { productCode: "ACL22C1ASKOB" },
    select: { name: true, rentalPrice: true, cardDiscountPrice: true, priceMatrix: true, specs: true },
  });
  if (!p) { console.log("not found"); return; }
  console.log(`상품명: ${p.name}`);
  console.log(`Product 기본 rentalPrice: ${p.rentalPrice}, cardDiscountPrice: ${p.cardDiscountPrice}`);
  console.log(`Product.specs["색상"]: ${(p.specs as Record<string,string>)?.["색상"]}`);
  console.log(`\npriceMatrix (${(p.priceMatrix as unknown as unknown[])?.length ?? 0} 옵션):`);
  for (const o of (p.priceMatrix as unknown as Array<Record<string,unknown>>) ?? []) {
    console.log(`  mode=${o.mode} | contract=${o.contractPeriod} | visit=${o.visitInterval} | rent=${o.rentalPrice} | card=${o.cardDiscountPrice} | base=${o.baseCommission} | variant="${o.variantLabel ?? ""}"`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
