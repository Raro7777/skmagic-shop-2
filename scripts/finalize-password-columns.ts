import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  // 잘못 추가된 failedLoginCount 컬럼 drop
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" DROP COLUMN IF EXISTS "failedLoginCount";`);
  console.log("✓ failedLoginCount 중복 컬럼 drop");
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
