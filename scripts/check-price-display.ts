import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    orderBy: [{ category: "asc" }, { rentalPrice: "desc" }],
    select: {
      productCode: true, name: true, rentalPrice: true, cardDiscountPrice: true,
      contractPeriod: true, managementType: true, category: true,
    },
  });

  // 가격 정합성 체크
  const issues: Array<{ kind: string; code: string; detail: string }> = [];
  for (const p of products) {
    if (p.cardDiscountPrice != null) {
      if (p.cardDiscountPrice > p.rentalPrice) {
        issues.push({ kind: "역전", code: p.productCode, detail: `card ${p.cardDiscountPrice} > rental ${p.rentalPrice}` });
      } else if (p.cardDiscountPrice === p.rentalPrice) {
        issues.push({ kind: "동일", code: p.productCode, detail: `card == rental ${p.rentalPrice} (할인 없음)` });
      } else {
        const savings = p.rentalPrice - p.cardDiscountPrice;
        const pct = Math.round((savings / p.rentalPrice) * 100);
        if (pct < 5) issues.push({ kind: "할인 ${pct}%", code: p.productCode, detail: `${savings}원 = ${pct}%` });
      }
    }
  }

  console.log(`📊 활성 상품 ${products.length}개`);
  console.log(`\n=== 카드할인가 정합성 ===`);
  if (issues.length === 0) {
    console.log(`✓ 모든 상품 정상 (할인가 < 운영가)`);
  } else {
    for (const i of issues) {
      console.log(`  [${i.kind}] ${i.code}: ${i.detail}`);
    }
  }

  // 샘플 — 카테고리별로 1개씩
  console.log(`\n=== 카테고리별 샘플 (1개씩) ===`);
  const seen = new Set<string>();
  for (const p of products) {
    if (seen.has(p.category)) continue;
    seen.add(p.category);
    const savings = p.cardDiscountPrice != null ? p.rentalPrice - p.cardDiscountPrice : null;
    const pct = savings != null && p.rentalPrice > 0 ? Math.round((savings / p.rentalPrice) * 100) : 0;
    console.log(`\n  [${p.category}] ${p.productCode}  ${p.name}`);
    console.log(`     운영가         : ${p.rentalPrice.toLocaleString()}원/월`);
    console.log(`     카드할인가     : ${p.cardDiscountPrice == null ? "—" : p.cardDiscountPrice.toLocaleString() + "원/월"}`);
    if (savings && savings > 0) {
      console.log(`     절약           : −${savings.toLocaleString()}원/월 (${pct}%)`);
    } else if (p.cardDiscountPrice === p.rentalPrice) {
      console.log(`     절약           : 없음 (카드할인가 = 운영가)`);
    }
    console.log(`     약정 / 관리방식 : ${p.contractPeriod}개월 / ${p.managementType}`);
  }

  // cardDiscountPrice 통계
  const sameCount = products.filter(p => p.cardDiscountPrice != null && p.cardDiscountPrice === p.rentalPrice).length;
  const diffCount = products.filter(p => p.cardDiscountPrice != null && p.cardDiscountPrice < p.rentalPrice).length;
  const nullCount = products.filter(p => p.cardDiscountPrice == null).length;
  console.log(`\n=== 카드할인가 분포 ===`);
  console.log(`  카드할인 있음 (운영가 > 할인가) : ${diffCount}개`);
  console.log(`  카드할인 없음 (= 운영가)         : ${sameCount}개  ⚠ 화면에서 "할인 없음" 처리 필요`);
  console.log(`  카드할인 미설정 (null)           : ${nullCount}개`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
