/**
 * HqPolicy 다중행 스키마 마이그레이션
 *
 *   기존: (productId UNIQUE) × baseCommission/monthIncentive/installSubsidy
 *   변경: (productId, mode, contractPeriod) UNIQUE × 동일 컬럼
 *
 * 1) ALTER — mode TEXT, contractPeriod INT, visitInterval TEXT 컬럼 추가 (nullable)
 * 2) DROP — productId UNIQUE 제약 제거
 * 3) 백필 — 기존 단일 row 의 mode/contractPeriod 를 Product.managementType+contractPeriod 로 채우고,
 *           Product.priceMatrix 의 나머지 옵션에 대한 row 들을 INSERT.
 * 4) NOT NULL — mode, contractPeriod 를 NOT NULL 로
 * 5) UNIQUE — (productId, mode, contractPeriod) 복합 unique 추가
 *
 * idempotent: 여러 번 돌려도 안전.
 */
import { prisma } from "../src/lib/prisma";

type PriceOption = {
  mode: string | null;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  ownershipPeriod: number;
  visitInterval: string | null;
  baseCommission: number;
  variantLabel?: string;
};

// priceMatrix 의 null mode 를 visitInterval 로 추정
function normalizeMode(mode: string | null, visitInterval: string | null): string {
  if (mode) return mode;
  if (visitInterval === "4개월") return "방문형";
  if (visitInterval === "12개월") return "셀프형";
  return "자가관리";
}

async function main() {
  console.log("─── Phase 1: ALTER TABLE ───");
  await prisma.$executeRawUnsafe(`ALTER TABLE "HqPolicy" ADD COLUMN IF NOT EXISTS "mode" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "HqPolicy" ADD COLUMN IF NOT EXISTS "contractPeriod" INT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "HqPolicy" ADD COLUMN IF NOT EXISTS "visitInterval" TEXT`);
  // 기존 unique constraint 제거 (prisma 가 생성한 이름)
  await prisma.$executeRawUnsafe(`ALTER TABLE "HqPolicy" DROP CONSTRAINT IF EXISTS "HqPolicy_productId_key"`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "HqPolicy_productId_key"`);
  console.log("  ✓ columns added, old unique dropped");

  console.log("─── Phase 2: backfill existing rows + insert option rows ───");
  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: {
      id: true, productCode: true, name: true,
      contractPeriod: true, managementType: true,
      priceMatrix: true,
    },
  });

  let updated = 0, inserted = 0, skipped = 0;
  for (const p of products) {
    const pm = (p.priceMatrix as unknown as PriceOption[] | null) ?? [];
    if (pm.length === 0) {
      // priceMatrix 없는 상품은 기존 단일 row 만 처리
      const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "HqPolicy" WHERE "productId" = $1`,
        p.id,
      );
      if (existing[0]) {
        const fallbackMode = p.managementType === "자가관리" ? "셀프형" : "방문형";
        await prisma.$executeRawUnsafe(
          `UPDATE "HqPolicy" SET "mode" = COALESCE("mode", $1), "contractPeriod" = COALESCE("contractPeriod", $2) WHERE id = $3`,
          fallbackMode, p.contractPeriod, existing[0].id,
        );
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    // priceMatrix 옵션마다 normalize 한 key 로 group
    const normalized: Map<string, PriceOption[]> = new Map();
    for (const opt of pm) {
      const m = normalizeMode(opt.mode, opt.visitInterval);
      const key = `${m}|${opt.contractPeriod}`;
      const list = normalized.get(key) ?? [];
      list.push({ ...opt, mode: m });
      normalized.set(key, list);
    }

    // 동일 (mode, contractPeriod) 에 여러 variant 가 있으면 (variantLabel 차이) 첫 번째 baseCommission 사용
    const optionsToUpsert: Array<{ mode: string; contractPeriod: number; visitInterval: string | null; baseCommission: number }> = [];
    for (const [, list] of normalized) {
      const opt = list[0];
      optionsToUpsert.push({
        mode: opt.mode!,
        contractPeriod: opt.contractPeriod,
        visitInterval: opt.visitInterval,
        baseCommission: opt.baseCommission,
      });
    }

    // 기존 단일 HqPolicy 가 있다면 첫 옵션으로 사용해 업데이트 (수동 편집된 값 보존)
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string; baseCommission: number; monthIncentive: number; installSubsidy: number; refundLimitRatio: number; mode: string | null; contractPeriod: number | null }>>(
      `SELECT id, "baseCommission", "monthIncentive", "installSubsidy", "refundLimitRatio", "mode", "contractPeriod" FROM "HqPolicy" WHERE "productId" = $1`,
      p.id,
    );

    // 우선 첫 옵션이 곧 "대표 정책" 이 되도록 — 기존 단일 row 가 있으면 그 값을 유지하면서 mode/contractPeriod 설정
    const head = optionsToUpsert[0];
    if (!head) {
      skipped++;
      continue;
    }

    if (existing[0] && !existing[0].mode) {
      // 첫 row 를 head 옵션으로 매핑 + 기존 baseCommission/incentive/subsidy 값 보존
      await prisma.$executeRawUnsafe(
        `UPDATE "HqPolicy" SET "mode" = $1, "contractPeriod" = $2, "visitInterval" = $3 WHERE id = $4`,
        head.mode, head.contractPeriod, head.visitInterval, existing[0].id,
      );
      updated++;
    }

    // 나머지 옵션은 (productId, mode, contractPeriod) 중복 없을 때만 INSERT
    for (const opt of optionsToUpsert) {
      const exists = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "HqPolicy" WHERE "productId" = $1 AND "mode" = $2 AND "contractPeriod" = $3`,
        p.id, opt.mode, opt.contractPeriod,
      );
      if (exists[0]) continue;
      // baseCommission 만 priceMatrix 의 값, 나머지(monthIncentive/refundLimit/installSubsidy)는 기존 단일 row 의 값 상속 OR 기본값
      const base = existing[0]?.installSubsidy ?? 30000;
      const refundLimit = existing[0]?.refundLimitRatio ?? 0.6667;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "HqPolicy" (id, "productId", "mode", "contractPeriod", "visitInterval", "baseCommission", "monthIncentive", "refundLimitRatio", "installSubsidy", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 0, $6, $7, NOW())`,
        p.id, opt.mode, opt.contractPeriod, opt.visitInterval, opt.baseCommission, refundLimit, base,
      );
      inserted++;
    }
  }
  console.log(`  ✓ updated=${updated} inserted=${inserted} skipped=${skipped}`);

  console.log("─── Phase 3: NOT NULL constraints ───");
  // null 인 row 가 남아있으면 안전한 기본값으로 (드물 것)
  await prisma.$executeRawUnsafe(`UPDATE "HqPolicy" SET "mode" = '방문형' WHERE "mode" IS NULL`);
  await prisma.$executeRawUnsafe(`UPDATE "HqPolicy" SET "contractPeriod" = 60 WHERE "contractPeriod" IS NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "HqPolicy" ALTER COLUMN "mode" SET NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "HqPolicy" ALTER COLUMN "contractPeriod" SET NOT NULL`);
  console.log("  ✓ mode, contractPeriod NOT NULL");

  console.log("─── Phase 4: composite UNIQUE ───");
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HqPolicy_productId_mode_contractPeriod_key"
     ON "HqPolicy"("productId", "mode", "contractPeriod")`,
  );
  console.log("  ✓ unique(productId, mode, contractPeriod)");

  console.log("─── 검증: 상품별 HqPolicy 행수 ───");
  const verify = await prisma.$queryRawUnsafe<Array<{ productCode: string; n: bigint }>>(
    `SELECT p."productCode", COUNT(h.id)::bigint as n
     FROM "Product" p LEFT JOIN "HqPolicy" h ON h."productId" = p.id
     WHERE p.status = 'active'
     GROUP BY p."productCode"
     ORDER BY n DESC, p."productCode"
     LIMIT 20`,
  );
  for (const row of verify) {
    console.log(`  ${row.productCode}: ${row.n} 행`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
