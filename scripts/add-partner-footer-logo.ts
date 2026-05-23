import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
if (!url) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("▶ Partner.footerLogoUrl 추가");
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "footerLogoUrl" TEXT`);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Partner' AND column_name = 'footerLogoUrl'`,
  );
  console.log("결과:", rows);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
