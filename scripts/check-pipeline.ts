import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const partners = await prisma.partner.findMany({ select: { partnerCode: true, partnerName: true } });
  for (const p of partners) {
    const counts = await prisma.lead.groupBy({
      by: ["status"],
      where: { partnerId: p.partnerCode },
      _count: { _all: true },
    });
    const total = await prisma.lead.count({ where: { partnerId: p.partnerCode } });
    const logCount = await prisma.leadStatusLog.count({
      where: { lead: { partnerId: p.partnerCode } },
    });
    console.log(`${p.partnerName} (${p.partnerCode})  total=${total}  logs=${logCount}`);
    for (const c of counts) console.log(`    ${c.status}: ${c._count._all}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
