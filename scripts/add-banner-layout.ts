import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "layout" TEXT NOT NULL DEFAULT 'classic';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "spotlightProductCode" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "stampText" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "sourceTemplateId" TEXT;`);
  console.log("✓ Banner: layout / spotlightProductCode / stampText / sourceTemplateId 추가");
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
