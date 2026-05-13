/**
 * 상담 신청 → Lead 저장 end-to-end 검증.
 *
 *   1) 실제 production API (/api/leads) 에 POST — ConsultForm 이 보내는 동일 페이로드
 *   2) DB 에서 lead 조회 → productCode / selectedMode / selectedContractPeriod 확인
 *   3) buildSettlementPayload 로직과 동일하게 정산 payload 시뮬레이션
 *   4) 검증 후 test lead 삭제
 */
import { prisma } from "../src/lib/prisma";

const API_URL = "https://skmagic-shop.com/api/leads";

async function main() {
  console.log("===== 상담 신청 end-to-end 검증 =====\n");

  // 시나리오: 사용자가 /p/partner-7714c0/products/ACL16C1ASKOB 페이지에서 방문형 60개월 선택 → 상담 신청
  const testPhone = "01099887766";
  const payload = {
    customerName: "테스트_검증",
    phone: testPhone,
    productInterest: "16평 올클린 디아트 공기청정기", // ConsultForm 에서 defaultProductLabel
    productCode: "ACL16C1ASKOB",                       // ★ 이번 수정 핵심 — 이전엔 null 됐었음
    region: "서울 강남구",
    landingType: "consumer_partner",
    partnerId: "partner-7714c0",
    selectedMode: "방문형",
    selectedContractPeriod: 60,
    selectedRentalPrice: 35900,
    selectedCardDiscountPrice: 28900,
    rivalCompensationRequested: false,
    selectedColor: "오트밀 베이지",
  };

  console.log("[1] POST /api/leads — ConsultForm 페이로드");
  console.log("    productCode:", payload.productCode);
  console.log("    selectedMode:", payload.selectedMode);
  console.log("    selectedContractPeriod:", payload.selectedContractPeriod);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log(`    응답 ${res.status}:`, data);

  if (!res.ok || !data.leadId) {
    console.log("⚠ 접수 실패 — 중단");
    return;
  }
  const leadId = data.leadId as string;

  console.log("\n[2] DB 에서 저장된 lead 조회");
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true, customerName: true, phoneRaw: true,
      productInterest: true, productCode: true,
      partnerId: true, sellerId: true,
      selectedMode: true, selectedContractPeriod: true, selectedRentalPrice: true,
      selectedCardDiscountPrice: true, selectedColor: true,
      rivalCompensationRequested: true, status: true, ownerType: true,
    },
  });
  if (!lead) { console.log("⚠ lead 미발견"); return; }

  console.log(`  id: ${lead.id}`);
  console.log(`  customerName: ${lead.customerName}`);
  console.log(`  phoneRaw: ${lead.phoneRaw}`);
  console.log(`  productInterest: ${lead.productInterest}`);
  console.log(`  productCode: ${lead.productCode}   ${lead.productCode === "ACL16C1ASKOB" ? "✅" : "❌ 불일치"}`);
  console.log(`  partnerId: ${lead.partnerId}`);
  console.log(`  sellerId: ${lead.sellerId ?? "(없음)"}`);
  console.log(`  selectedMode: ${lead.selectedMode}   ${lead.selectedMode === "방문형" ? "✅" : "❌"}`);
  console.log(`  selectedContractPeriod: ${lead.selectedContractPeriod}   ${lead.selectedContractPeriod === 60 ? "✅" : "❌"}`);
  console.log(`  selectedRentalPrice: ${lead.selectedRentalPrice}`);
  console.log(`  selectedCardDiscountPrice: ${lead.selectedCardDiscountPrice}`);
  console.log(`  selectedColor: ${lead.selectedColor}`);
  console.log(`  rivalCompensationRequested: ${lead.rivalCompensationRequested}`);
  console.log(`  status: ${lead.status}`);
  console.log(`  ownerType: ${lead.ownerType}`);

  console.log("\n[3] install_done 시 buildSettlementPayload 결과 (시뮬레이션 — 실제 상태 변경 안 함)");
  const { computeHqMargin, computeSellerMargin, computeMarginFlow } = await import("../src/lib/marginFlow");
  const { rentalSupportFor } = await import("../src/lib/rentalSupport");

  const product = await prisma.product.findUnique({
    where: { productCode: lead.productCode! },
    include: {
      hqPolicies: true,
      partnerPolicies: { where: { partnerId: lead.partnerId! } },
    },
  });
  const partner = await prisma.partner.findUnique({
    where: { partnerCode: lead.partnerId! },
    select: { rentalSupportAmount: true, tier: true, sellerMarginType: true, sellerMarginAmount: true, sellerMarginPercent: true },
  });
  const tierMargin = partner ? await prisma.hqMarginByTier.findUnique({ where: { tier: partner.tier } }) : null;

  if (product && partner && tierMargin) {
    const opt = product.hqPolicies.find(h => h.mode === lead.selectedMode && h.contractPeriod === lead.selectedContractPeriod);
    if (opt) {
      const baseCommission = opt.baseCommission + opt.monthIncentive;
      const tierMarginConfig = { type: tierMargin.marginType as "fixed" | "percent", amount: tierMargin.marginAmount, percent: tierMargin.marginPercent };
      const hqMargin = computeHqMargin(baseCommission, opt, tierMarginConfig);
      const partnerCommission = baseCommission - hqMargin;
      const pp = product.partnerPolicies[0];
      const gift = pp?.giftAmount ?? 0;
      const install = pp?.installAmount ?? 0;
      const rentalSupport = rentalSupportFor(partnerCommission, partner.rentalSupportAmount, gift, install);
      const hasSeller = !!lead.sellerId;
      const sellerMargin = hasSeller
        ? computeSellerMargin(partnerCommission, partner, pp ?? null)
        : 0;
      const flow = computeMarginFlow({
        baseCommission, hqMargin, giftReturned: gift, installReturned: install,
        rentalSupportReturned: rentalSupport, sellerMargin, hasSeller,
      });
      console.log(`  매칭 옵션: ${opt.mode} ${opt.contractPeriod}개월   ✅ lead 의 selectedMode + selectedContractPeriod 와 일치`);
      console.log(`  baseCommission(본사수수료): ₩${flow.baseCommission.toLocaleString("ko-KR")}`);
      console.log(`  hqMargin(본사마진): ₩${flow.hqMargin.toLocaleString("ko-KR")}`);
      console.log(`  partnerCommission(영업점수수료): ₩${flow.partnerCommission.toLocaleString("ko-KR")}`);
      console.log(`  giftReturned: ₩${flow.giftReturned.toLocaleString("ko-KR")}`);
      console.log(`  installReturned: ₩${flow.installReturned.toLocaleString("ko-KR")}`);
      console.log(`  rentalSupportReturned: ₩${flow.rentalSupportReturned.toLocaleString("ko-KR")}`);
      console.log(`  sellerMargin: ₩${flow.sellerMargin.toLocaleString("ko-KR")}`);
      console.log(`  sellerPayout: ₩${flow.sellerPayout.toLocaleString("ko-KR")}`);
      console.log(`  netPayout(협력점 실수령): ₩${flow.netPayout.toLocaleString("ko-KR")}`);
    } else {
      console.log(`  ⚠ HqPolicy 옵션 미발견 (mode=${lead.selectedMode}, contractPeriod=${lead.selectedContractPeriod})`);
    }
  }

  console.log("\n[4] 검증용 test lead 삭제");
  await prisma.leadStatusLog.deleteMany({ where: { leadId } });
  await prisma.lead.delete({ where: { id: leadId } });
  console.log(`  ✓ ${leadId} 삭제됨`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
