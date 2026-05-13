/**
 * 마진 흐름 스키마 마이그레이션 (Phase 1)
 *
 *   1) HqMarginByTier 신규 (티어별 본사마진 기본값) — 초기 시드 5/4/3/2%
 *   2) HqPolicy: marginType/Amount/Percent 컬럼 추가 (상품별 override, nullable)
 *   3) Partner: sellerMarginType/Amount/Percent 컬럼 추가 (영업자 마진 기본값)
 *   4) PartnerPolicy: sellerMarginAmount/Percent 컬럼 추가 (상품별 override)
 *   5) Settlement: hqMargin/partnerCommission/sellerMargin/sellerPayout 컬럼 추가 + 백필
 *
 * idempotent.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("─── 1) HqMarginByTier 생성 + 시드 ───");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HqMarginByTier" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tier TEXT UNIQUE NOT NULL,
      "marginType" TEXT NOT NULL DEFAULT 'percent',
      "marginAmount" INTEGER NOT NULL DEFAULT 0,
      "marginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )
  `);
  for (const [tier, percent] of [["basic", 0.05], ["standard", 0.04], ["premium", 0.03], ["enterprise", 0.02]] as const) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "HqMarginByTier" (tier, "marginType", "marginPercent") VALUES ($1, 'percent', $2) ON CONFLICT (tier) DO NOTHING`,
      tier, percent,
    );
  }
  console.log("  ✓ 4개 티어 시드");

  console.log("─── 2) HqPolicy 컬럼 추가 ───");
  await prisma.$executeRawUnsafe(`ALTER TABLE "HqPolicy" ADD COLUMN IF NOT EXISTS "marginType" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "HqPolicy" ADD COLUMN IF NOT EXISTS "marginAmount" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "HqPolicy" ADD COLUMN IF NOT EXISTS "marginPercent" DOUBLE PRECISION`);
  console.log("  ✓ marginType/Amount/Percent (nullable)");

  console.log("─── 3) Partner 컬럼 추가 ───");
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "sellerMarginType" TEXT NOT NULL DEFAULT 'fixed'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "sellerMarginAmount" INTEGER NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "sellerMarginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0`);
  console.log("  ✓ sellerMargin*");

  console.log("─── 4) PartnerPolicy 컬럼 추가 ───");
  await prisma.$executeRawUnsafe(`ALTER TABLE "PartnerPolicy" ADD COLUMN IF NOT EXISTS "sellerMarginAmount" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "PartnerPolicy" ADD COLUMN IF NOT EXISTS "sellerMarginPercent" DOUBLE PRECISION`);
  console.log("  ✓ sellerMarginAmount/Percent (nullable)");

  console.log("─── 5) Settlement 컬럼 추가 + 백필 ───");
  await prisma.$executeRawUnsafe(`ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "hqMargin" INTEGER NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "partnerCommission" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "sellerMargin" INTEGER NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "sellerPayout" INTEGER NOT NULL DEFAULT 0`);
  // 기존 Settlement: partnerCommission = baseCommission (마진 도입 전 데이터는 hqMargin=0 가정)
  const updated = await prisma.$executeRawUnsafe(`UPDATE "Settlement" SET "partnerCommission" = "baseCommission" WHERE "partnerCommission" IS NULL`);
  console.log(`  ✓ ${updated} 기존 Settlement 행 백필`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Settlement" ALTER COLUMN "partnerCommission" SET NOT NULL`);

  console.log("─── 검증 ───");
  const tiers = await prisma.$queryRawUnsafe<Array<{ tier: string; marginType: string; marginPercent: number; marginAmount: number }>>(
    `SELECT tier, "marginType", "marginPercent", "marginAmount" FROM "HqMarginByTier" ORDER BY tier`,
  );
  console.log("HqMarginByTier:");
  for (const t of tiers) {
    console.log(`  ${t.tier}: type=${t.marginType} percent=${t.marginPercent} amount=${t.marginAmount}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
