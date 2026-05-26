/**
 * pending CrawledProduct 가 실제로 승인 가능한 상태인지 사전 진단.
 *   - changeType="new"  : 같은 productCode 가 이미 Product 에 있으면 "false new"
 *   - changeType="updated": 매칭되는 Product 가 없으면 "orphan"
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const pending = await prisma.crawledProduct.findMany({
    where: { approvalStatus: "pending" },
    select: { id: true, productCode: true, name: true, changeType: true, crawledAt: true },
  });

  const productCodes = Array.from(new Set(pending.map(p => p.productCode).filter((x): x is string => !!x)));
  const products = await prisma.product.findMany({
    where: { productCode: { in: productCodes } },
    select: { productCode: true, status: true },
  });
  const productMap = new Map(products.map(p => [p.productCode, p.status]));

  const falseNew: typeof pending = [];
  const orphan: typeof pending = [];
  const okNew: typeof pending = [];
  const okUpdated: typeof pending = [];
  const missingCode: typeof pending = [];

  for (const c of pending) {
    if (!c.productCode) { missingCode.push(c); continue; }
    const exists = productMap.has(c.productCode);
    if (c.changeType === "new") {
      if (exists) falseNew.push(c); else okNew.push(c);
    } else if (c.changeType === "updated") {
      if (exists) okUpdated.push(c); else orphan.push(c);
    }
  }

  console.log("\n=== Pending 진단 요약 ===");
  console.log(`  정상 new      : ${okNew.length}`);
  console.log(`  정상 updated  : ${okUpdated.length}`);
  console.log(`  ⚠ false new (productCode 이미 존재 — 승인 시 unique 충돌) : ${falseNew.length}`);
  console.log(`  ⚠ orphan (updated 인데 매칭 Product 없음 — 승인 시 throw)  : ${orphan.length}`);
  console.log(`  ⚠ missing productCode : ${missingCode.length}`);

  if (falseNew.length > 0) {
    console.log("\n=== false new 상세 ===");
    for (const c of falseNew) {
      console.log(`  ${c.productCode} ${c.name} (${c.crawledAt.toISOString().slice(0, 10)}) → Product.status=${productMap.get(c.productCode!)}`);
    }
  }
  if (orphan.length > 0) {
    console.log("\n=== orphan 상세 ===");
    for (const c of orphan) {
      console.log(`  ${c.productCode} ${c.name} (${c.crawledAt.toISOString().slice(0, 10)})`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
