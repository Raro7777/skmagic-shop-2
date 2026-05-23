/**
 * Phase 0 schema 추가:
 *   - Partner: csHours, csLunchHours, csHolidays (컨슈머 사이트 노출용)
 *   - Seller: telegramChatId (본인 lead 인입 시 영업자 본인 알림)
 *   - HqSetting: 본사 가입조건 fact sheet (단일 row 싱글톤)
 *
 * 멱등성: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
if (!url) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("▶ Partner CS 필드 추가");
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "csHours" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "csLunchHours" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "csHolidays" TEXT`);

  console.log("▶ Seller.telegramChatId 추가");
  await prisma.$executeRawUnsafe(`ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT`);

  console.log("▶ HqSetting 테이블 생성");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HqSetting" (
      "id" INTEGER PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
      "joinConditions" JSONB,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedById" TEXT
    )
  `);
  // 초기 singleton row
  await prisma.$executeRawUnsafe(`INSERT INTO "HqSetting" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING`);

  console.log("✅ 마이그레이션 완료");

  // 검증
  const partner = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Partner' AND column_name IN ('csHours','csLunchHours','csHolidays')`,
  );
  const seller = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Seller' AND column_name = 'telegramChatId'`,
  );
  const hqSetting = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, "joinConditions" FROM "HqSetting"`,
  );
  console.log("Partner CS columns:", partner);
  console.log("Seller.telegramChatId:", seller);
  console.log("HqSetting rows:", hqSetting);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
