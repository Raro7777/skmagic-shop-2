import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { rentalSupportFor } from "@/lib/rentalSupport";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  // 대표 상품 몇 종 골라 priceMatrix 안의 commission 값 확인
  const products = await prisma.product.findMany({
    where: { productCode: { in: ["WPUIAC506SNS", "WPUIAC414SPB", "WPUJAC115PPN", "WPUIAC606SNW"] } },
    select: { productCode: true, name: true, priceMatrix: true },
  });

  const partnerSupportAmount = 200000; // partner-7714c0
  const giftAmount = 0;     // 대략
  const installAmount = 0;  // 대략

  for (const p of products) {
    console.log(`\n[${p.productCode}] ${p.name}`);
    type Opt = { mode: string | null; contractPeriod: number; partnerCommission?: number; baseCommission?: number; rentalPrice?: number };
    const opts = (p.priceMatrix as unknown as Opt[]) ?? [];
    for (const o of opts.slice(0, 6)) {
      const commission = o.partnerCommission ?? o.baseCommission ?? 0;
      const support = rentalSupportFor(commission, partnerSupportAmount, giftAmount, installAmount);
      const status = support > 0 ? "✅ 노출" : "❌ 미노출";
      console.log(`  ${(o.mode ?? "단일").padEnd(6)} ${o.contractPeriod}개월  rental=${o.rentalPrice ?? "?"}  partnerComm=${o.partnerCommission ?? "-"}  baseComm=${o.baseCommission ?? "-"}  → support=${support}  ${status}`);
    }
  }
  await prisma.$disconnect();
}
main();
