import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const codes = ["WPUIAC506SNS", "WPUIAC606SNW", "WPUIAC414SPB", "WPUJAC115DNW", "WPUJAC115PPN", "WPUMAC306SWH", "WPUJAC104SWH", "WPUIAC425SNW"];
  for (const code of codes) {
    const prod = await p.product.findUnique({ where: { productCode: code }, select: { id: true, name: true, updatedAt: true } });
    if (!prod) { console.log(`  ${code}  없음`); continue; }
    const hqPolicies = await p.hqPolicy.findMany({
      where: { productId: prod.id },
      select: { baseCommission: true, monthIncentive: true, marginType: true, marginAmount: true, marginPercent: true, contractPeriod: true, updatedAt: true },
      orderBy: [{ contractPeriod: "asc" }],
    });
    console.log(`\n[${code}] ${prod.name}  policies=${hqPolicies.length}`);
    for (const h of hqPolicies.slice(0, 6)) {
      const marginStr = h.marginType === "percent" ? `${h.marginPercent}%` : h.marginType === "fixed" ? String(h.marginAmount) : "-";
      console.log(`  ${String(h.contractPeriod).padStart(2)}월  baseComm=${h.baseCommission}  incentive=${h.monthIncentive}  margin=${marginStr}  updated=${h.updatedAt.toISOString().slice(0,10)}`);
    }
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
