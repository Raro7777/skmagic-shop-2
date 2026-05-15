import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const code = process.argv[2] ?? "WPUJAC125SVB";
  const p = await prisma.product.findUnique({
    where: { productCode: code },
    select: { productCode: true, name: true, priceMatrix: true },
  });
  if (!p) { console.log("not found"); process.exit(1); }
  console.log(`${p.productCode} / ${p.name}`);
  const matrix = (p.priceMatrix as unknown as Array<Record<string, unknown>>) ?? [];
  console.log(`options: ${matrix.length}`);
  for (const o of matrix) {
    console.log(JSON.stringify(o));
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
