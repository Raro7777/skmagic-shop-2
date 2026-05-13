import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT TRUE;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordUpdatedAt" TIMESTAMP(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);`);
  console.log("✓ User: mustChangePassword / passwordUpdatedAt / failedLoginCount / lockedUntil 컬럼 추가");

  // 본사 sunhong2k@gmail.com 은 예외 — mustChangePassword=false 처리
  await prisma.user.update({
    where: { email: "sunhong2k@gmail.com" },
    data: { mustChangePassword: false, passwordUpdatedAt: new Date() },
  });
  console.log("✓ sunhong2k@gmail.com — mustChangePassword=false (본사 예외 적용)");

  // 인터넷끝판왕 partner_admin 계정은 mustChangePassword=true (다음 로그인 시 강제 변경)
  const intkingUsers = await prisma.user.updateMany({
    where: { partnerId: "partner-7714c0", role: "partner_admin" },
    data: { mustChangePassword: true },
  });
  console.log(`✓ 인터넷끝판왕 partner_admin ${intkingUsers.count}명 — mustChangePassword=true`);
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
