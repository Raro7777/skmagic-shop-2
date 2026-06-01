import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const p = await prisma.product.findUnique({
    where: { productCode: "WPUJAC104SWH" },
    select: {
      productCode: true, name: true, rentalPrice: true, baseRentalPrice: true,
      promoRentalPrice: true, cardDiscountPrice: true, priceMatrix: true,
    },
  });
  if (!p) { console.log("없음"); return; }
  console.log(`=== ${p.productCode} ${p.name} ===`);
  console.log(`rentalPrice=${p.rentalPrice}  baseRentalPrice=${p.baseRentalPrice}  promoRentalPrice=${p.promoRentalPrice}  cardDiscountPrice=${p.cardDiscountPrice}`);
  console.log(`\n=== priceMatrix JSON ===`);
  const mat = p.priceMatrix as Array<Record<string, unknown>> | null;
  if (!Array.isArray(mat)) { console.log("(없음 또는 배열 아님)"); return; }
  for (const m of mat) {
    console.log(JSON.stringify(m));
  }
  console.log(`\nmatrix row 수: ${mat.length}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
