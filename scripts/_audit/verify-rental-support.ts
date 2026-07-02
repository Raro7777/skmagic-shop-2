/**
 * 렌탈지원금 전방위 점검.
 *   1) partner-7714c0 (우성종합통신) 설정 값 확인
 *   2) 대표 상품 옵션별 baseCommission → rentalSupport 계산 결과 (partner-7714c0 기준)
 *   3) 협력점 셀러 컨텍스트별 노출 여부 예측 (컨슈머 메인 vs 영업자)
 *   4) 최근 7월 apply 후 다른 협력점 (rentalSupport 다르게 설정된 곳) 시나리오
 */
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { rentalSupportFor } from "@/lib/rentalSupport";

async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  // 1) 대상 협력점들 확인
  const partners = await p.partner.findMany({
    where: { status: "active" },
    select: {
      partnerCode: true, partnerName: true, brandSafeMode: true,
      rentalSupportEnabled: true, rentalSupportAmount: true, tier: true,
    },
    orderBy: { partnerCode: "asc" },
  });
  console.log("=== [1] 협력점별 렌탈지원금 설정 ===");
  for (const pr of partners) {
    console.log(`  ${pr.partnerCode}  [${pr.tier}]  brandSafe=${pr.brandSafeMode}  enabled=${pr.rentalSupportEnabled}  amount=${pr.rentalSupportAmount}`);
  }
  console.log();

  // 2) 대표 상품 옵션의 partnerCommission 계산 (우성종합통신 기준)
  console.log("=== [2] 대표 상품 옵션별 baseCommission → rentalSupport (200,000원 보장 마진 기준) ===");
  const partnerAmount = 200000; // partner-7714c0
  const targets = ["WPUIAC506SNS", "WPUIAC606SNW", "WPUIAC414SPB", "WPUJAC115DNW", "WPUJAC115PPN", "WPUJAC104SWH", "WPUJAC125SNW", "WPUMAC306SWH", "WPUTDC104RNW", "WPUPBC204SWH"];
  const products = await p.product.findMany({
    where: { productCode: { in: targets } },
    select: { productCode: true, name: true, priceMatrix: true },
  });
  for (const prod of products) {
    console.log(`\n  [${prod.productCode}] ${prod.name}`);
    type Opt = { mode: string | null; contractPeriod: number; baseCommission?: number | null; partnerCommission?: number | null; rentalPrice?: number };
    const opts = prod.priceMatrix as unknown as Opt[];
    if (!Array.isArray(opts) || opts.length === 0) {
      console.log("    (옵션 없음)");
      continue;
    }
    for (const o of opts.slice(0, 4)) {
      const commission = o.partnerCommission ?? o.baseCommission ?? 0;
      const support = rentalSupportFor(commission, partnerAmount);
      console.log(`    ${(o.mode ?? "단일").padEnd(6)} ${String(o.contractPeriod).padStart(2)}월  rental=${o.rentalPrice ?? "?"}  baseComm=${o.baseCommission ?? "-"}  → support=${support}원 ${support > 0 ? "✅" : "❌"}`);
    }
  }

  // 3) 시나리오 시뮬
  console.log("\n=== [3] 노출 시나리오 ===");
  console.log("  A) 컨슈머 메인 (sellerCode 없음): brandSafeMode ON 협력점(우성) → 차단  ❌ 노출 안 됨");
  console.log("  B) 영업자 URL (sellerCode 있음): brandSafeMode ON 협력점(우성) → 풀 노출 ✅");
  console.log("  C) brandSafeMode OFF 협력점: 항상 rentalSupportEnabled 값 그대로");

  // 4) 다른 협력점 렌탈지원금 설정 요약
  console.log("\n=== [4] rentalSupport 활성 협력점 요약 ===");
  const active = partners.filter(x => x.rentalSupportEnabled && x.rentalSupportAmount > 0);
  console.log(`  총 활성 협력점: ${active.length}/${partners.length}`);
  for (const a of active) {
    console.log(`    ${a.partnerCode}  amount=${a.rentalSupportAmount}  brandSafe=${a.brandSafeMode}  → 컨슈머 메인 노출=${a.brandSafeMode ? "차단" : "노출"}`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
