import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const partners = await prisma.partner.findMany({
    where: {
      OR: [
        { partnerName: { contains: "끝판왕" } },
        { partnerName: { contains: "인터넷" } },
        { partnerCode: { contains: "intking" } },
      ],
    },
    select: { partnerCode: true, partnerName: true, brandLabel: true, hotlineNumber: true, customDomain: true, customDomainStatus: true },
  });
  console.log(JSON.stringify(partners, null, 2));
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
