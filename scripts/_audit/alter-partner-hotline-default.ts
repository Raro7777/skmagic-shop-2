/**
 * Partner.hotlineNumber column default 변경: '1600-2434' → ''
 * - 컬럼 type/NULL 허용 그대로
 * - 안전한 ALTER (기존 row 영향 없음, 새 row 의 default 만 바뀜)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("▶ Partner.hotlineNumber default 변경");

  const before = await prisma.$queryRaw<{ column_default: string }[]>`
    SELECT column_default FROM information_schema.columns
    WHERE table_name='Partner' AND column_name='hotlineNumber';
  `;
  console.log(`  BEFORE default: ${before[0]?.column_default ?? "(없음)"}`);

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Partner" ALTER COLUMN "hotlineNumber" SET DEFAULT '';`
  );

  const after = await prisma.$queryRaw<{ column_default: string }[]>`
    SELECT column_default FROM information_schema.columns
    WHERE table_name='Partner' AND column_name='hotlineNumber';
  `;
  console.log(`  AFTER default:  ${after[0]?.column_default ?? "(없음)"}`);
  console.log(`✅ default 변경 완료`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
