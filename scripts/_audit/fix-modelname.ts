/**
 * Phase 2 — modelName 정정.
 *
 * 원인:
 *   seed-26-products.ts 가 source Product 의 modelName 을 그대로 차용했기 때문에,
 *   color/size 만 다른 신규 시드의 modelName 이 source 의 코드로 남아 있음.
 *   (예: WPUIAC606SSB.modelName = "WPUIAC606SNW")
 *
 * 수정:
 *   시드 Product 중 modelName !== productCode 인 모든 row 를 modelName = productCode 로 갱신.
 *
 * 실행:
 *   DRY-RUN:  npx tsx scripts/_audit/fix-modelname.ts
 *   APPLY:    APPLY=1 npx tsx scripts/_audit/fix-modelname.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.env.APPLY === "1" || process.argv.includes("--apply");

async function main() {
  console.log(`\n=== Phase 2: fix-modelname ===`);
  console.log(`mode: ${APPLY ? "🚀 APPLY" : "🧪 DRY-RUN"}\n`);

  const seeded = await prisma.product.findMany({
    where: { description: { contains: "[seeded from" } },
    select: { productCode: true, name: true, modelName: true },
  });
  console.log(`대상 시드 Product: ${seeded.length}개`);

  const mismatched = seeded.filter(p => p.modelName !== p.productCode);
  console.log(`modelName !== productCode: ${mismatched.length}개\n`);

  for (const p of mismatched) {
    console.log(`  - ${p.productCode}  current modelName="${p.modelName}"  → "${p.productCode}"`);
  }

  if (!APPLY) {
    console.log(`\n🧪 DRY-RUN — 실제 적용:`);
    console.log(`   APPLY=1 npx tsx scripts/_audit/fix-modelname.ts\n`);
    return;
  }

  console.log(`\n🚀 APPLY — modelName UPDATE\n`);
  let n = 0;
  for (const p of mismatched) {
    await prisma.product.update({
      where: { productCode: p.productCode },
      data: { modelName: p.productCode },
    });
    n++;
  }
  console.log(`✓ ${n} Product modelName 갱신 완료.`);

  // 사후 검증
  console.log(`\n=== 사후 검증 ===`);
  const verify = await prisma.product.findMany({
    where: { description: { contains: "[seeded from" } },
    select: { productCode: true, modelName: true },
  });
  const stillBad = verify.filter(p => p.modelName !== p.productCode);
  if (stillBad.length === 0) console.log(`  ✓ 모든 시드 Product 의 modelName == productCode`);
  else {
    console.log(`  ✗ 잔존 mismatch: ${stillBad.length}개`);
    for (const p of stillBad) console.log(`     - ${p.productCode}  modelName="${p.modelName}"`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
