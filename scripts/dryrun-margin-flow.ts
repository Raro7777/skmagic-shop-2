/**
 * 마진 흐름 드라이런 — 실제 DB 데이터로 정산 계산을 시뮬레이션.
 *
 *   본사수수료 (HqPolicy)
 *     - 본사마진 (티어 기본값 또는 옵션 override)
 *   = 영업점수수료 (정책 표기 + 환수 기준)
 *     - 환원 (사은품/설치/렌탈지원)
 *   = 영업점 풀
 *     영업자 없음 → 협력점 실수령 = 풀
 *     영업자 있음 → sellerPayout = 영업점수수료 - 영업점마진
 *                  netPayout = sellerMargin - 환원
 */
import { prisma } from "../src/lib/prisma";
import { computeHqMargin, computeSellerMargin, computeMarginFlow } from "../src/lib/marginFlow";

const fmt = (n: number) => "₩" + n.toLocaleString("ko-KR");

async function main() {
  console.log("\n===== 드라이런: 정산 마진 흐름 검증 =====\n");

  // ─── 환경 ───
  const partner = await prisma.partner.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
  });
  if (!partner) {
    console.log("⚠ active 협력점이 없습니다.");
    return;
  }
  const tierMargins = await prisma.hqMarginByTier.findMany();
  const tierRow = tierMargins.find(t => t.tier === partner.tier);
  const tierMargin = tierRow
    ? { type: tierRow.marginType as "fixed" | "percent", amount: tierRow.marginAmount, percent: tierRow.marginPercent }
    : null;

  console.log(`협력점: ${partner.partnerName} (${partner.partnerCode})`);
  console.log(`  티어: ${partner.tier}`);
  console.log(`  렌탈지원금 (총액): ${fmt(partner.rentalSupportAmount)}`);
  console.log(`  영업자 마진 기본값: ${partner.sellerMarginType === "fixed" ? fmt(partner.sellerMarginAmount) : (partner.sellerMarginPercent * 100).toFixed(2) + "%"}`);
  if (tierMargin) {
    console.log(`  티어별 본사마진: ${tierMargin.type === "fixed" ? fmt(tierMargin.amount) : (tierMargin.percent * 100).toFixed(2) + "%"}`);
  }
  console.log();

  // ─── 사용자가 예시로 든 시나리오와 가까운 상품 픽: 본사수수료 ~50만원 ───
  const product = await prisma.product.findFirst({
    where: { status: "active" },
    include: {
      hqPolicies: true,
      partnerPolicies: { where: { partnerId: partner.partnerCode } },
    },
    orderBy: { hqPolicies: { _count: "desc" } },
  });
  if (!product) {
    console.log("⚠ active 상품이 없습니다.");
    return;
  }

  // 방문형 60개월 옵션 우선, 없으면 첫 옵션
  const opt =
    product.hqPolicies.find(h => h.mode === "방문형" && h.contractPeriod === 60)
    ?? product.hqPolicies[0];
  if (!opt) {
    console.log("⚠ HqPolicy 옵션 없음");
    return;
  }
  console.log(`상품: ${product.name} [${product.productCode}]`);
  console.log(`  옵션: ${opt.mode} ${opt.contractPeriod}개월 (방문주기 ${opt.visitInterval ?? "—"})`);
  console.log();

  // ─── 케이스 A: 영업자 없음, 환원 100,000 / 설치 30,000 ───
  await runCase("케이스 A · 영업자 없음 · 환원 ₩100,000 + 설치 ₩30,000", {
    baseCommission: opt.baseCommission + opt.monthIncentive,
    hqPolicyForOption: opt,
    tierMargin,
    partnerSupportAmount: partner.rentalSupportAmount,
    giftAmount: 100000,
    installAmount: 30000,
    partner: { sellerMarginType: partner.sellerMarginType, sellerMarginAmount: partner.sellerMarginAmount, sellerMarginPercent: partner.sellerMarginPercent },
    partnerPolicyOverride: null,
    hasSeller: false,
  });

  // ─── 케이스 B: 영업자 있음 (협력점 영업자마진 기본값 사용) ───
  await runCase("케이스 B · 영업자 있음 · 협력점 영업자마진 기본값", {
    baseCommission: opt.baseCommission + opt.monthIncentive,
    hqPolicyForOption: opt,
    tierMargin,
    partnerSupportAmount: partner.rentalSupportAmount,
    giftAmount: 100000,
    installAmount: 30000,
    partner: { sellerMarginType: partner.sellerMarginType, sellerMarginAmount: partner.sellerMarginAmount, sellerMarginPercent: partner.sellerMarginPercent },
    partnerPolicyOverride: null,
    hasSeller: true,
  });

  // ─── 케이스 C: 영업자 있음 · 영업자마진 override ₩50,000 ───
  await runCase("케이스 C · 영업자 있음 · 영업자마진 override ₩50,000 (상품별)", {
    baseCommission: opt.baseCommission + opt.monthIncentive,
    hqPolicyForOption: opt,
    tierMargin,
    partnerSupportAmount: partner.rentalSupportAmount,
    giftAmount: 100000,
    installAmount: 30000,
    partner: { sellerMarginType: partner.sellerMarginType, sellerMarginAmount: partner.sellerMarginAmount, sellerMarginPercent: partner.sellerMarginPercent },
    partnerPolicyOverride: { sellerMarginAmount: 50000, sellerMarginPercent: null },
    hasSeller: true,
  });

  // ─── 케이스 D: 사용자 예시 그대로 — 본사수수료 ₩500,000, 본사마진 ₩20,000, 렌탈지원 ₩300,000 ───
  console.log("\n────────────────────────────────────────────");
  console.log("케이스 D · 사용자 예시 그대로 수동 시나리오");
  console.log("  baseCommission(본사수수료) = ₩500,000");
  console.log("  hqMargin(본사마진) = ₩20,000 (고정)");
  console.log("  gift(렌탈지원금/사은품) = ₩300,000");
  console.log("  영업자 없음");
  console.log("────────────────────────────────────────────");
  const manualFlow = computeMarginFlow({
    baseCommission: 500000,
    hqMargin: 20000,
    giftReturned: 300000,
    installReturned: 0,
    rentalSupportReturned: 0,
    sellerMargin: 0,
    hasSeller: false,
  });
  printFlow(manualFlow);
  console.log(`✓ 사용자 예상: 영업점수수료 ${fmt(480000)}, 지급될 수수료 ${fmt(180000)}`);
  console.log(`✓ 계산 결과: 영업점수수료 ${fmt(manualFlow.partnerCommission)}, netPayout ${fmt(manualFlow.netPayout)}`);
  console.log(`✓ 환수 한도 (영업점수수료): ${fmt(manualFlow.partnerCommission)}`);
}

async function runCase(label: string, ctx: {
  baseCommission: number;
  hqPolicyForOption: Parameters<typeof computeHqMargin>[1];
  tierMargin: Parameters<typeof computeHqMargin>[2];
  partnerSupportAmount: number;
  giftAmount: number;
  installAmount: number;
  partner: { sellerMarginType: string; sellerMarginAmount: number; sellerMarginPercent: number };
  partnerPolicyOverride: { sellerMarginAmount: number | null; sellerMarginPercent: number | null } | null;
  hasSeller: boolean;
}) {
  console.log("\n────────────────────────────────────────────");
  console.log(label);
  console.log("────────────────────────────────────────────");

  const hqMargin = computeHqMargin(ctx.baseCommission, ctx.hqPolicyForOption, ctx.tierMargin);
  const partnerCommission = ctx.baseCommission - hqMargin;

  // 렌탈지원 — partnerCommission 기준 ⅔ 한도 (간단 시뮬: 단순 차감)
  // 실제 rentalSupportFor 함수와 동일 의미 — 여기선 단순 계산
  const refundLimit = Math.floor(partnerCommission * (ctx.hqPolicyForOption?.refundLimitRatio ?? 0.6667));
  const giftPlusInstall = ctx.giftAmount + ctx.installAmount;
  let rentalSupport = 0;
  const remainingForSupport = refundLimit - giftPlusInstall;
  if (remainingForSupport > 0 && ctx.partnerSupportAmount > 0) {
    rentalSupport = Math.floor(Math.min(ctx.partnerSupportAmount, remainingForSupport) / 10000) * 10000;
  }

  const sellerMargin = ctx.hasSeller
    ? computeSellerMargin(partnerCommission, ctx.partner as never, ctx.partnerPolicyOverride as never)
    : 0;

  const flow = computeMarginFlow({
    baseCommission: ctx.baseCommission,
    hqMargin,
    giftReturned: ctx.giftAmount,
    installReturned: ctx.installAmount,
    rentalSupportReturned: rentalSupport,
    sellerMargin,
    hasSeller: ctx.hasSeller,
  });
  printFlow(flow);
}

function printFlow(f: ReturnType<typeof computeMarginFlow>) {
  console.log(`  본사수수료:        ${fmt(f.baseCommission)}`);
  console.log(`  − 본사마진:        ${fmt(f.hqMargin)}`);
  console.log(`  = 영업점수수료:    ${fmt(f.partnerCommission)}   ★ 정책 표기 + 환수 한도`);
  console.log(`  − 사은품:          ${fmt(f.giftReturned)}`);
  console.log(`  − 설치 환원:       ${fmt(f.installReturned)}`);
  console.log(`  − 렌탈지원:        ${fmt(f.rentalSupportReturned)}`);
  if (f.sellerPayout > 0 || f.sellerMargin > 0) {
    console.log(`  영업점마진:       ${fmt(f.sellerMargin)}   (협력점이 가져가는 몫)`);
    console.log(`  영업자수수료:     ${fmt(f.sellerPayout)}   (영업자에게 지급)`);
  }
  console.log(`  = 협력점 실수령:   ${fmt(f.netPayout)}   ${f.netPayout < 0 ? "(⚠ 마이너스)" : ""}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
