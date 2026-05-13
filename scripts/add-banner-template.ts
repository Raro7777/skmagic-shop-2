import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BannerTemplate" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT,
      "layout" TEXT NOT NULL DEFAULT 'classic',
      "title" TEXT NOT NULL,
      "subtitle" TEXT,
      "imageUrl" TEXT,
      "bgColor1" TEXT NOT NULL DEFAULT '#1A2B4D',
      "bgColor2" TEXT NOT NULL DEFAULT '#F26A1F',
      "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
      "ctaLabel" TEXT,
      "ctaHref" TEXT,
      "stampText" TEXT,
      "spotlightProductCode" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BannerTemplate_status_idx" ON "BannerTemplate"("status");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BannerTemplate_category_idx" ON "BannerTemplate"("category");`);
  console.log("✓ BannerTemplate 테이블 생성");
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
