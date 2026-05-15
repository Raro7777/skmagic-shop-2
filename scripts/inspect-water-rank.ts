import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const products = await prisma.product.findMany({
    where: { status: "active", category: "water" },
    select: {
      productCode: true,
      modelName: true,
      rentalPrice: true,
      priceMatrix: true,
      hqPolicies: { select: { baseCommission: true, contractPeriod: true, mode: true, marginAmount: true } },
    },
  });
  const rows = products.map(p => {
    const matrix = (p.priceMatrix as unknown as Array<{
      rivalCompensationHalfPriceMonths?: number | null;
      rivalCompensationPrice?: number | null;
    }>) ?? [];
    const halfMonths = matrix.find(o => (o.rivalCompensationHalfPriceMonths ?? 0) > 0)?.rivalCompensationHalfPriceMonths ?? 0;
    const hasRival = matrix.some(o => (o.rivalCompensationPrice ?? 0) > 0);
    const maxComm = Math.max(0, ...p.hqPolicies.map(h => (h.baseCommission ?? 0) - (h.marginAmount ?? 0)));
    return { code: p.productCode, model: p.modelName, rental: p.rentalPrice, maxComm, halfMonths, hasRival };
  });
  rows.sort((a, b) => b.maxComm - a.maxComm);
  console.log("rank | code | model | rental | maxComm | half | rival");
  rows.slice(0, 20).forEach((r, i) => {
    const tag = r.halfMonths > 0 ? `HALF-${r.halfMonths}` : "    ";
    console.log(`${String(i + 1).padStart(2)}    ${r.code.padEnd(14)} ${r.model.padEnd(16)} ${String(r.rental).padStart(6)} ${String(r.maxComm).padStart(7)} ${tag} ${r.hasRival ? "R" : ""}`);
  });
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
