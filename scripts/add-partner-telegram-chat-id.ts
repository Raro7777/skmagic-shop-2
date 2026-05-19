/**
 * Partner.telegramChatId 컬럼 추가 (nullable).
 *
 * 사용법:
 *   npx tsx scripts/add-partner-telegram-chat-id.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  console.log("→ Partner.telegramChatId 컬럼 추가...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Partner"
    ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT
  `);
  const r = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Partner' AND column_name = 'telegramChatId'
  `);
  console.log(r.length > 0 ? "✓ 컬럼 추가 확인" : "✗ 컬럼 추가 실패");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
