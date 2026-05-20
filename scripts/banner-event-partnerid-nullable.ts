import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
(async () => {
  await prisma.$executeRawUnsafe(`ALTER TABLE "BannerEvent" ALTER COLUMN "partnerId" DROP NOT NULL`);
  console.log("✓ BannerEvent.partnerId nullable");
})().finally(() => prisma.$disconnect());
