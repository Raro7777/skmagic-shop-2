import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "customDomain" TEXT;`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Partner_customDomain_key" ON "Partner"("customDomain");`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "customDomainStatus" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "customDomainAddedAt" TIMESTAMP(3);`);
  console.log("✓ Partner.customDomain / customDomainStatus / customDomainAddedAt 추가");
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
