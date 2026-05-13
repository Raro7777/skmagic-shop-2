import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  // 본사 sunhong2k@gmail.com → mustChangePassword=false (예외)
  await prisma.user.update({
    where: { email: "sunhong2k@gmail.com" },
    data: { mustChangePassword: false, passwordUpdatedAt: new Date() },
  });
  console.log("✓ sunhong2k@gmail.com — mustChangePassword=false");

  // 인터넷끝판왕 partner_admin → mustChangePassword=true (다음 로그인 시 강제 변경)
  const intking = await prisma.user.updateMany({
    where: { partnerId: "partner-7714c0", role: "partner_admin" },
    data: { mustChangePassword: true },
  });
  console.log(`✓ 인터넷끝판왕 partner_admin ${intking.count}명 — mustChangePassword=true`);
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
