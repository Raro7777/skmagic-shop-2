/**
 * 상담 신청 → Lead → Settlement 흐름 드라이런 (실제 lead 생성 없음, 시뮬레이션).
 *
 *   1) 사용자가 /p/partner-7714c0/products/[productCode] 에서 PriceConfigurator 옵션 선택
 *   2) ConsultForm 으로 lead 제출 → Lead 행 가상 시뮬레이션 (DB 미저장)
 *   3) install_done 처리 시 buildSettlementPayload 가 어떤 값들로 채울지 시뮬레이션
 */
import { prisma } from "../src/lib/prisma";
import { computeHqMargin, computeSellerMargin, computeMarginFlow } from "../src/lib/marginFlow";
import { rentalSupportFor } from "../src/lib/rentalSupport";

const fmt = (n: number) => "₩" + n.toLocaleString("ko-KR");

async function main() {
  console.log("===== 상담 신청 → 정산 흐름 종합 시뮬레이션 =====\n");

  // 환경
  const partner = await prisma.partner.findUnique({
    where: { partnerCode: "partner-7714c0" },
  });
  if (!partner) throw new Error("partner not found");
  const tierMarginRow = await prisma.hqMarginByTier.findUnique({ where: { tier: partner.tier } });
  const tierMargin = tierMarginRow ? {
    type: tierMarginRow.marginType as "fixed" | "percent",
    amount: tierMarginRow.marginAmount,
    percent: tierMarginRow.marginPercent,
  } : null;

  console.log(`[협력점] ${partner.partnerName} (tier: ${partner.tier})`);
  console.log(`  렌탈지원금: ${fmt(partner.rentalSupportAmount)} (enabled: ${partner.rentalSupportEnabled})`);
  console.log(`  영업자마진: ${partner.sellerMarginType === "fixed" ? fmt(partner.sellerMarginAmount) : (partner.sellerMarginPercent * 100) + "%"}\n`);

  // 시나리오 1: 사용자가 16평 디아트 공기청정기 페이지에서 방문형 60개월 선택 → 상담 신청
  const productCode = "ACL16C1ASKOB";
  const selectedMode = "방문형";
  const selectedContractPeriod = 60;
  console.log(`[사용자 상품 페이지] /p/partner-7714c0/products/${productCode}`);
  console.log(`  PriceConfigurator 선택: ${selectedMode} ${selectedContractPeriod}개월`);
  console.log(`  sessionStorage["rk:purchase-config"] 저장 → ConsultForm 으로 전달`);
  console.log();

  const product = await prisma.product.findUnique({
    where: { productCode },
    include: {
      hqPolicies: true,
      partnerPolicies: { where: { partnerId: partner.partnerCode } },
    },
  });
  if (!product) {
    console.log(`⚠ ${productCode} 상품 미존재`);
    return;
  }

  // ConsultForm submit 시 lead 에 들어가는 값
  console.log("[ConsultForm POST /api/leads body]");
  console.log(`  productInterest: "${product.name}"`);
  console.log(`  productCode: "${productCode}"   ← 핵심 (이전엔 PRODUCTS 매칭 실패로 null 됐었음)`);
  console.log(`  selectedMode: "${selectedMode}"`);
  console.log(`  selectedContractPeriod: ${selectedContractPeriod}`);
  console.log(`  partnerId: "${partner.partnerCode}"`);
  console.log();

  // install_done 시 buildSettlementPayload 가 만들 정산
  const opt = product.hqPolicies.find(h => h.mode === selectedMode && h.contractPeriod === selectedContractPeriod);
  if (!opt) {
    console.log("⚠ 해당 옵션의 HqPolicy 미존재");
    return;
  }
  const baseCommission = opt.baseCommission + opt.monthIncentive;
  const hqMargin = computeHqMargin(baseCommission, opt, tierMargin);
  const partnerCommission = baseCommission - hqMargin;

  const partnerPolicy = product.partnerPolicies[0];
  const gift = partnerPolicy?.giftAmount ?? 0;
  const install = partnerPolicy?.installAmount ?? 0;
  const rentalSupport = rentalSupportFor(partnerCommission, partner.rentalSupportAmount, gift, install);

  console.log("[install_done 시 자동 Settlement 생성]");
  console.log(`  매칭된 HqPolicy 옵션: ${opt.mode} ${opt.contractPeriod}개월`);
  console.log(`  baseCommission(본사수수료): ${fmt(baseCommission)}`);
  console.log(`  hqMargin(본사마진): ${fmt(hqMargin)}`);
  console.log(`  partnerCommission(영업점수수료): ${fmt(partnerCommission)}   ★ 정책 표기 + 환수 한도`);
  console.log(`  giftReturned(사은품): ${fmt(gift)}${partnerPolicy?.giftLabel ? ` (${partnerPolicy.giftLabel})` : ""}`);
  console.log(`  installReturned(설치비): ${fmt(install)}`);
  console.log(`  rentalSupportReturned(렌탈지원): ${fmt(rentalSupport)}`);
  console.log();

  // 영업자 시나리오 비교
  console.log("─── 영업자 없는 경우 (consumer_partner 직접 진입) ───");
  const flowNoSeller = computeMarginFlow({
    baseCommission, hqMargin, giftReturned: gift, installReturned: install,
    rentalSupportReturned: rentalSupport, sellerMargin: 0, hasSeller: false,
  });
  console.log(`  netPayout(협력점 실수령): ${fmt(flowNoSeller.netPayout)}`);
  console.log(`  sellerPayout: ${fmt(0)}`);

  console.log("\n─── 영업자 있는 경우 (consumer_seller 단독 링크 진입) ───");
  const sellerMargin = computeSellerMargin(partnerCommission, partner, partnerPolicy);
  const flowSeller = computeMarginFlow({
    baseCommission, hqMargin, giftReturned: gift, installReturned: install,
    rentalSupportReturned: rentalSupport, sellerMargin, hasSeller: true,
  });
  console.log(`  sellerMargin(영업점 몫): ${fmt(sellerMargin)}`);
  console.log(`  sellerPayout(영업자 받음): ${fmt(flowSeller.sellerPayout)}`);
  console.log(`  netPayout(협력점 실수령): ${fmt(flowSeller.netPayout)}${flowSeller.netPayout < 0 ? " ⚠ 마이너스" : ""}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
