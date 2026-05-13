/**
 * 렌탈지원금 자동 다운스케일 검증 — 영업자 있는 lead 의 협력점 마이너스 방지.
 */
import { prisma } from "../src/lib/prisma";
import { rentalSupportFor } from "../src/lib/rentalSupport";
import { computeHqMargin, computeSellerMargin, computeMarginFlow } from "../src/lib/marginFlow";

const fmt = (n: number) => "₩" + n.toLocaleString("ko-KR");

async function runCase(label: string, params: {
  baseCommission: number;
  hqMargin: number;
  giftReturned: number;
  installReturned: number;
  partnerSupportAmount: number;
  sellerMargin: number;
  hasSeller: boolean;
}) {
  console.log("\n────────────────────────────────────────────");
  console.log(label);
  console.log("────────────────────────────────────────────");

  const partnerCommission = params.baseCommission - params.hqMargin;
  const rentalSupport = rentalSupportFor(
    partnerCommission,
    params.partnerSupportAmount,
    params.giftReturned,
    params.installReturned,
    params.hasSeller ? params.sellerMargin : undefined,
  );

  const flow = computeMarginFlow({
    baseCommission: params.baseCommission,
    hqMargin: params.hqMargin,
    giftReturned: params.giftReturned,
    installReturned: params.installReturned,
    rentalSupportReturned: rentalSupport,
    sellerMargin: params.hasSeller ? params.sellerMargin : 0,
    hasSeller: params.hasSeller,
  });

  console.log(`  본사수수료: ${fmt(flow.baseCommission)}`);
  console.log(`  − 본사마진: ${fmt(flow.hqMargin)}`);
  console.log(`  = 영업점수수료: ${fmt(flow.partnerCommission)}`);
  console.log(`  − 사은품: ${fmt(flow.giftReturned)}`);
  console.log(`  − 설치비: ${fmt(flow.installReturned)}`);
  console.log(`  − 렌탈지원: ${fmt(flow.rentalSupportReturned)}   (설정 ${fmt(params.partnerSupportAmount)}, 자동 cap)`);
  if (params.hasSeller) {
    console.log(`  영업점마진: ${fmt(flow.sellerMargin)}`);
    console.log(`  영업자수수료: ${fmt(flow.sellerPayout)}`);
  }
  console.log(`  → 협력점 실수령: ${fmt(flow.netPayout)}   ${flow.netPayout < 0 ? "⚠ 마이너스" : flow.netPayout === 0 ? "(딱 0)" : "✓"}`);
}

async function main() {
  console.log("===== 렌탈지원금 자동 다운스케일 검증 =====");

  const partner = await prisma.partner.findUnique({ where: { partnerCode: "partner-7714c0" } });
  if (!partner) throw new Error();
  const tierMargin = await prisma.hqMarginByTier.findUnique({ where: { tier: partner.tier } });
  const tierMarginConfig = tierMargin ? {
    type: tierMargin.marginType as "fixed" | "percent",
    amount: tierMargin.marginAmount,
    percent: tierMargin.marginPercent,
  } : null;

  // 16평 디아트 공기청정기 방문형 60개월 옵션
  const product = await prisma.product.findUnique({
    where: { productCode: "ACL16C1ASKOB" },
    include: { hqPolicies: true },
  });
  const opt = product?.hqPolicies.find(h => h.mode === "방문형" && h.contractPeriod === 60);
  if (!opt) throw new Error();

  const baseCommission = opt.baseCommission + opt.monthIncentive;
  const hqMargin = computeHqMargin(baseCommission, opt, tierMarginConfig);
  const sellerMargin = computeSellerMargin(baseCommission - hqMargin, partner, null);

  console.log(`\n협력점: ${partner.partnerName}`);
  console.log(`  영업자 마진 기본: ${fmt(sellerMargin)}`);
  console.log(`  렌탈지원금 설정: ${fmt(partner.rentalSupportAmount)}\n`);

  // 케이스 1: 영업자 없음 + 환원 0
  await runCase("케이스 1 · 영업자 없음 · 환원 0", {
    baseCommission, hqMargin, giftReturned: 0, installReturned: 0,
    partnerSupportAmount: partner.rentalSupportAmount, sellerMargin, hasSeller: false,
  });

  // 케이스 2: 영업자 있음 + 환원 0 + 렌탈지원 200,000 → 영업점마진 20,000 → 자동 다운스케일?
  await runCase("케이스 2 · 영업자 있음 · 환원 0 · 렌탈지원 ₩200,000 설정", {
    baseCommission, hqMargin, giftReturned: 0, installReturned: 0,
    partnerSupportAmount: partner.rentalSupportAmount, sellerMargin, hasSeller: true,
  });

  // 케이스 3: 영업자 있음 + 사은품 30,000 + 영업점마진 50,000 가정 (override)
  await runCase("케이스 3 · 영업자 있음 · 사은품 ₩30,000 · 영업점마진 ₩50,000 (override)", {
    baseCommission, hqMargin, giftReturned: 30000, installReturned: 0,
    partnerSupportAmount: partner.rentalSupportAmount, sellerMargin: 50000, hasSeller: true,
  });

  // 케이스 4: 사용자 D 시나리오 — 본사수수료 500,000, 본사마진 20,000, 사은품 300,000, 영업자 없음
  await runCase("케이스 4 · 사용자 D 시나리오 (영업자 없음, 사은품 30만)", {
    baseCommission: 500000, hqMargin: 20000, giftReturned: 300000, installReturned: 0,
    partnerSupportAmount: 200000, sellerMargin: 0, hasSeller: false,
  });

  // 케이스 5: 동일 시나리오 + 영업자 있음 — 협력점 마이너스 안 나는지 확인
  await runCase("케이스 5 · 사용자 D 시나리오 + 영업자 있음 (영업점마진 ₩20,000)", {
    baseCommission: 500000, hqMargin: 20000, giftReturned: 300000, installReturned: 0,
    partnerSupportAmount: 200000, sellerMargin: 20000, hasSeller: true,
  });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
