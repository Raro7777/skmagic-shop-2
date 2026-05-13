import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const codes = ["WPUJCC104SWH", "WPUMAC306SWH", "ACL15C1ASKWH", "BIDS17DR64WH", "MATSM430RLWH"];
  for (const code of codes) {
    const p = await prisma.product.findUnique({
      where: { productCode: code },
      include: { hqPolicy: true },
    });
    if (!p) { console.log(`${code}: 없음`); continue; }
    console.log(`${code} — ${p.name} (${p.managementType})`);
    console.log(`   rentalPrice         ${p.rentalPrice.toLocaleString()}원/월`);
    console.log(`   cardDiscountPrice   ${(p.cardDiscountPrice ?? 0).toLocaleString()}원/월`);
    console.log(`   hqPolicy.commission ${(p.hqPolicy?.baseCommission ?? 0).toLocaleString()}원 (대당)`);
  }

  console.log(`\n변경 이력 최근 10건`);
  const logs = await prisma.productChangeLog.findMany({
    where: { source: "hq_policy" },
    orderBy: { detectedAt: "desc" },
    take: 10,
  });
  for (const l of logs) {
    const p = await prisma.product.findUnique({ where: { id: l.productId }, select: { productCode: true } });
    console.log(`  [${p?.productCode ?? "?"}] ${l.fieldName.padEnd(28)} ${l.oldValue ?? "—"} → ${l.newValue ?? "—"}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
