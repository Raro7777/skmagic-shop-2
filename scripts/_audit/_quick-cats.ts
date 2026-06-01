import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client"; import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const cats = await prisma.crawledProduct.groupBy({ by: ["category"], _count: { _all: true } });
  console.log("=== CrawledProduct 카테고리 ===");
  for (const c of cats) console.log(`  ${c.category}: ${c._count._all}건`);

  const matCrawled = await prisma.crawledProduct.findMany({
    where: { OR: [
      { category: { contains: "매트" } },
      { name: { contains: "매트리스" } },
      { name: { contains: "패드" } },
      { modelName: { startsWith: "MAT" } },
    ]},
    select: { id: true, productCode: true, name: true, modelName: true, imageUrl: true, category: true },
    take: 10,
  });
  console.log(`\n=== 매트리스 CrawledProduct sample (${matCrawled.length}) ===`);
  for (const c of matCrawled) console.log(`  ${c.productCode ?? "—"} | ${c.modelName ?? "—"} | "${(c.name ?? "").slice(0, 50)}" | ${c.imageUrl ? "✓img" : "✗"}`);

  // 공기청정기 ACL*
  const aclCrawled = await prisma.crawledProduct.findMany({
    where: { OR: [
      { modelName: { startsWith: "ACL" } },
      { name: { contains: "올클린" } },
      { name: { contains: "디아트" } },
    ]},
    select: { id: true, productCode: true, name: true, modelName: true, imageUrl: true, category: true },
    take: 20,
  });
  console.log(`\n=== 공기청정기 ACL CrawledProduct (${aclCrawled.length}) ===`);
  for (const c of aclCrawled) console.log(`  ${c.productCode ?? "—"} | ${c.modelName ?? "—"} | "${(c.name ?? "").slice(0, 50)}" | ${c.imageUrl ? "✓img" : "✗"}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
