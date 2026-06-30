import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client"; import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const p = await prisma.partner.findUnique({ where: { partnerCode: "partner-7714c0" }, select: { partnerName: true, telegramChatId: true } });
  console.log(p);
  console.log("\nenv 본사 chat:", process.env.TELEGRAM_CHAT_ID_HQ ?? "(없음)");
  console.log("env BOT_TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "있음" : "없음");
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());
