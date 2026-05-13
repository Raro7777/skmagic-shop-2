import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BannerEvent" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "bannerId" TEXT NOT NULL,
      "partnerId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "ip" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BannerEvent_bannerId_idx" ON "BannerEvent"("bannerId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BannerEvent_partnerId_eventType_idx" ON "BannerEvent"("partnerId","eventType");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BannerEvent_createdAt_idx" ON "BannerEvent"("createdAt");`);
  console.log("✓ BannerEvent 테이블 생성");
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
