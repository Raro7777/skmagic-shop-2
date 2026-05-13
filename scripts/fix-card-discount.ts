/**
 * cardDiscountPrice 정합성 정정:
 *   - 역전 (card > rental): card를 null로 (의미 없는 할인)
 *   - 동일 (card == rental): card를 null로 (할인 없음)
 *   - 정상 (card < rental): 유지
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const products = await prisma.product.findMany({
    where: { status: "active", cardDiscountPrice: { not: null } },
    select: { id: true, productCode: true, name: true, rentalPrice: true, cardDiscountPrice: true },
  });

  let fixed = 0;
  let logsCreated = 0;

  for (const p of products) {
    if (p.cardDiscountPrice == null) continue;
    const isInverted = p.cardDiscountPrice > p.rentalPrice;
    const isSame = p.cardDiscountPrice === p.rentalPrice;
    if (!isInverted && !isSame) continue;

    const reason = isInverted ? "역전(card > rental)" : "동일(card == rental)";
    await prisma.$transaction(async tx => {
      await tx.product.update({
        where: { id: p.id },
        data: { cardDiscountPrice: null },
      });
      await tx.productChangeLog.create({
        data: {
          productId: p.id,
          fieldName: "cardDiscountPrice",
          oldValue: String(p.cardDiscountPrice),
          newValue: null,
          source: "data_cleanup",
        },
      });
    });
    fixed++;
    logsCreated++;
    console.log(`  ${p.productCode.padEnd(15)} ${p.name.padEnd(30)} ${reason} : card=${p.cardDiscountPrice} / rental=${p.rentalPrice} → null`);
  }

  console.log(`\n✅ 정정 ${fixed}건 / 로그 ${logsCreated}건`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
