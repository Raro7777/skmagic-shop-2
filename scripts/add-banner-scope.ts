/**
 * Banner.scope (partner|global) 컬럼 추가 + partnerId NULL 허용.
 * scope="global" 인 row 는 본사 공통 배너로 모든 활성 협력점 컨슈머 사이트에 노출.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  console.log("→ Banner.scope TEXT DEFAULT 'partner' NOT NULL 추가...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Banner"
    ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'partner'
  `);

  console.log("→ Banner.partnerId NULL 허용...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Banner" ALTER COLUMN "partnerId" DROP NOT NULL
  `);

  console.log("→ scope 인덱스 추가...");
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Banner_scope_status_idx" ON "Banner"("scope", "status")
  `);

  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string; is_nullable: string }>>(`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_name = 'Banner' AND column_name IN ('scope', 'partnerId')
    ORDER BY column_name
  `);
  console.log("✓ 결과:", cols);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
