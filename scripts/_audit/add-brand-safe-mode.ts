import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const exists = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM information_schema.columns
    WHERE table_name='Partner' AND column_name='brandSafeMode';
  `;
  if (Number(exists[0]?.count ?? 0) === 0) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN "brandSafeMode" boolean NOT NULL DEFAULT true;`);
    console.log("✅ brandSafeMode 컬럼 추가 (default true)");
  } else {
    console.log("ℹ 컬럼 이미 존재");
  }

  // 사후 검증 — 7개 협력점 brandSafeMode 상태
  const partners = await prisma.partner.findMany({
    select: { partnerCode: true, partnerName: true, brandSafeMode: true },
    orderBy: { partnerName: "asc" },
  });
  console.log(`\n=== 협력점 brandSafeMode 상태 ===`);
  for (const p of partners) {
    console.log(`  ${p.partnerName.padEnd(20)} (${p.partnerCode}) — ${p.brandSafeMode ? "🔒 안전모드 ON" : "🔓 풀 노출"}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
