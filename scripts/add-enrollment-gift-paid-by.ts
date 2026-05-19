/** EnrollmentForm.giftPaidBy / giftCashAmount 컬럼 추가. */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  console.log("→ EnrollmentForm.giftPaidBy TEXT 추가...");
  await prisma.$executeRawUnsafe(`ALTER TABLE "EnrollmentForm" ADD COLUMN IF NOT EXISTS "giftPaidBy" TEXT`);
  console.log("→ EnrollmentForm.giftCashAmount INTEGER 추가...");
  await prisma.$executeRawUnsafe(`ALTER TABLE "EnrollmentForm" ADD COLUMN IF NOT EXISTS "giftCashAmount" INTEGER`);

  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'EnrollmentForm' AND column_name IN ('giftPaidBy', 'giftCashAmount')
    ORDER BY column_name
  `);
  console.log(`✓ 컬럼 확인: ${cols.map(c => c.column_name).join(", ")}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
