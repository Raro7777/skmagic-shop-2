import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const recent = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, customerName: true, phoneRaw: true, region: true, duplicateStatus: true, createdAt: true },
  });
  for (const l of recent) {
    console.log(`${l.id}  ${l.customerName.padEnd(8)}  ${l.phoneRaw}  region=${l.region ?? "-"}  dup=${l.duplicateStatus ?? "null"}`);
  }
  console.log("\n--- by duplicate_status ---");
  for (const status of [null, "confirmed", "possible", "bad_db"]) {
    const c = await prisma.lead.count({ where: { duplicateStatus: status } });
    console.log(`  ${status ?? "(null)"} → ${c}`);
  }
}
main().finally(() => prisma.$disconnect());
