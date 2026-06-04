/**
 * 진단: MEGA ICE mini 시리즈 priceMatrix 중복 + 이미지/모델명 불일치 확인.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const TARGETS = ["WPUIAC606SNW", "WPUIAC606SOB", "WPUIAC606SSB"];
  for (const code of TARGETS) {
    const p = await prisma.product.findUnique({
      where: { productCode: code },
      select: {
        productCode: true, name: true, modelName: true, status: true,
        imageUrl: true, imageUrls: true,
        rentalPrice: true, baseRentalPrice: true, promoRentalPrice: true,
        priceMatrix: true, description: true,
      },
    });
    if (!p) { console.log(`${code}: 없음`); continue; }
    console.log(`\n========== ${p.productCode} ==========`);
    console.log(`  name:         ${p.name}`);
    console.log(`  modelName:    ${p.modelName}`);
    console.log(`  status:       ${p.status}`);
    console.log(`  imageUrl:     ${p.imageUrl?.slice(0, 80) ?? "(null)"}`);
    console.log(`  imageUrls:    ${(p.imageUrls?.length ?? 0)}개`);
    console.log(`  rentalPrice:  ${p.rentalPrice}`);
    console.log(`  description:  ${p.description?.slice(0, 150) ?? "(null)"}`);

    const mat = p.priceMatrix as Array<Record<string, unknown>> | null;
    if (!Array.isArray(mat)) { console.log(`  priceMatrix:  (없음)`); continue; }

    // mode + contractPeriod 별 그룹화 → 중복 검출
    const groups = new Map<string, number>();
    for (const opt of mat) {
      const key = `${opt.mode}|${opt.contractPeriod}m`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    console.log(`  priceMatrix row 수: ${mat.length}`);
    console.log(`  고유 mode×period: ${groups.size}`);
    const dups = [...groups.entries()].filter(([_, n]) => n > 1);
    if (dups.length > 0) {
      console.log(`  ⚠ 중복 옵션:`);
      for (const [k, n] of dups) console.log(`     ${k} → ${n}번`);
    } else {
      console.log(`  ✅ 중복 없음`);
    }

    // 상세 row dump
    for (const opt of mat) {
      console.log(`    [${opt.mode}/${opt.contractPeriod}m] basePrice=${opt.basePrice} promo=${opt.promoPrice} variant="${String(opt.variantLabel ?? "").slice(0, 30)}"`);
    }
  }

  // 전체 26개 신규 시드 중 priceMatrix 중복 검사
  console.log(`\n\n========== 전체 신규 시드 26개 priceMatrix 중복 검사 ==========`);
  const seeded = await prisma.product.findMany({
    where: { description: { contains: "[seeded from" } },
    select: { productCode: true, name: true, modelName: true, priceMatrix: true, imageUrl: true },
  });
  console.log(`시드된 Product: ${seeded.length}개`);
  let dupCount = 0, modelMismatch = 0;
  for (const p of seeded) {
    const mat = p.priceMatrix as Array<Record<string, unknown>> | null;
    if (Array.isArray(mat)) {
      const groups = new Map<string, number>();
      for (const opt of mat) {
        const key = `${opt.mode}|${opt.contractPeriod}m`;
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
      const dups = [...groups.entries()].filter(([_, n]) => n > 1);
      if (dups.length > 0) {
        dupCount++;
        console.log(`  ⚠ ${p.productCode} "${p.name.slice(0, 30)}" — 중복 ${dups.length}개 (총 row ${mat.length})`);
      }
    }
    // modelName != productCode 인 시드 (source 의 modelName 차용한 경우)
    if (p.modelName && p.modelName !== p.productCode) {
      modelMismatch++;
    }
  }
  console.log(`\n총 중복 priceMatrix Product: ${dupCount}/${seeded.length}`);
  console.log(`modelName != productCode (시드 source 차용): ${modelMismatch}/${seeded.length}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
