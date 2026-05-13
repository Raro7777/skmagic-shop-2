import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "selectedColor" TEXT;`);
  console.log("✓ Lead.selectedColor 컬럼 추가");
  await prisma.$executeRawUnsafe(`ALTER TABLE "EnrollmentForm" ADD COLUMN IF NOT EXISTS "selectedColor" TEXT;`);
  console.log("✓ EnrollmentForm.selectedColor 컬럼 추가");
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
