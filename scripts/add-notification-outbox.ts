import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NotificationOutbox" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "channel" TEXT NOT NULL,
      "toAddress" TEXT NOT NULL,
      "subject" TEXT,
      "body" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "sentAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "NotificationOutbox_status_idx" ON "NotificationOutbox"("status");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "NotificationOutbox_channel_status_idx" ON "NotificationOutbox"("channel","status");`);
  console.log("✓ NotificationOutbox 테이블 생성 + 인덱스");
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
