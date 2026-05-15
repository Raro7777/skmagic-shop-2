import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const code = process.argv[2] ?? "partner-7714c0";
  const partner = await prisma.partner.findUnique({
    where: { partnerCode: code },
    select: { partnerCode: true, partnerName: true, displayConfig: true },
  });
  if (!partner) { console.log(`partner not found: ${code}`); process.exit(1); }
  console.log(`partner: ${partner.partnerCode} / ${partner.partnerName}`);
  console.log("displayConfig:");
  console.dir(partner.displayConfig, { depth: 5 });
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
