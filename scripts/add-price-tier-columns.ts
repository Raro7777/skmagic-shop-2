/**
 * Migration — Product 테이블에 3-tier 가격 컬럼 추가.
 *   baseRentalPrice  (Int?) — 기준가
 *   promoRentalPrice (Int?) — 5월 판촉가 (전사 할인)
 * rentalPrice 는 운영가로 의미 그대로 유지.
 * cardDiscountPrice 는 매직몰 카드할인 (-15k) 으로 의미 유지.
 *
 * 이미 컬럼이 있으면 noop (IF NOT EXISTS).
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  console.log("▶ ALTER TABLE Product ADD COLUMN baseRentalPrice, promoRentalPrice");
  await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "baseRentalPrice" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "promoRentalPrice" INTEGER`);
  console.log("✓ 컬럼 추가 완료");

  // 검증
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Product' AND column_name IN ('baseRentalPrice','rentalPrice','promoRentalPrice','cardDiscountPrice') ORDER BY column_name`,
  );
  console.log("\n현재 Product 가격 컬럼:");
  for (const c of cols) console.log(`  ${c.column_name.padEnd(20)} ${c.data_type}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
