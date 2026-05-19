/** BannerTemplate.fullClickable 컬럼 추가 + image-only layout 허용용 (layout 컬럼 자체는 String 이라 schema 변경 없음). */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  console.log("→ BannerTemplate.fullClickable BOOLEAN DEFAULT false 추가...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "BannerTemplate"
    ADD COLUMN IF NOT EXISTS "fullClickable" BOOLEAN NOT NULL DEFAULT false
  `);
  const r = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'BannerTemplate' AND column_name = 'fullClickable'
  `);
  console.log(r.length > 0 ? "✓ 컬럼 추가 확인" : "✗ 컬럼 추가 실패");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
