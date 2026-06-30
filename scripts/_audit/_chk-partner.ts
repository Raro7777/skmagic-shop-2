import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client"; import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const p = await prisma.partner.findUnique({
    where: { partnerCode: "partner-7714c0" },
    select: { partnerName: true, hotlineNumber: true, kakaoChannelUrl: true },
  });
  console.log(p);
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());
