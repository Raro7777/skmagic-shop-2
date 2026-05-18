/**
 * E2E 라이프사이클 테스트
 *
 * 시나리오:
 *   1. 상담 신청 (consult_wish)
 *   2. 협력점 응대 (consult_active)
 *   3. EnrollmentForm 작성 (form_ready)
 *   4. 본사 제출 (apply_submitted → verify_pending 자동 chain)
 *   5. 본사 인증 통과 (verify_passed → install_pending 자동 chain)
 *   6. 본사 설치 완료 (install_done → settle_pending 자동 chain + Settlement 생성)
 *   7. 본사 정산 완료 (settle_done + Settlement.status="paid")
 *   8. 환수 시작 → 진행 → 완료 (refund_pending → progress → done)
 *   9. 역전이 테스트: settle_done → install_pending (Settlement 자동 cancelled)
 *
 * 각 단계마다 DB 상태 assertion. 마지막에 test lead/enrollment/settlement 모두 정리.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { updateLeadStatus } from "@/lib/leadStore";
import { startRefund, advanceRefund } from "@/lib/settlementStore";

const PARTNER_CODE = "partner-7714c0";
const PRODUCT_CODE = "WPUIAC506SNW"; // MEGA ICE

let pass = 0;
let fail = 0;
const assertEq = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}: ${JSON.stringify(actual)}`); }
  else { fail++; console.log(`  ✗ ${label}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`); }
};
const assertTruthy = (label: string, v: unknown) => {
  if (v) { pass++; console.log(`  ✓ ${label}: ${JSON.stringify(v).slice(0, 60)}`); }
  else { fail++; console.log(`  ✗ ${label}: falsy (${JSON.stringify(v)})`); }
};

async function main() {
  console.log("══════════════════════════════════════");
  console.log("  E2E LIFECYCLE TEST");
  console.log("══════════════════════════════════════\n");

  // 사전 정리 — 기존 테스트 lead 있으면 삭제
  await prisma.lead.deleteMany({ where: { phoneRaw: "010-9999-0001" } });

  // ─── STEP 1: 상담 신청 (consult_wish) ───
  console.log("STEP 1 — consult_wish (신규 상담 신청)");
  const lead = await prisma.lead.create({
    data: {
      customerName: "E2E 테스트",
      phoneRaw: "010-9999-0001",
      productInterest: "MEGA ICE 얼음정수기",
      productCode: PRODUCT_CODE,
      partnerId: PARTNER_CODE,
      ownerType: "partner",
      source: "consumer_form",
      selectedMode: "방문형",
      selectedContractPeriod: 60,
      selectedRentalPrice: 65900,
      selectedCardDiscountPrice: 41900,
    },
  });
  assertEq("Lead 생성", lead.status, "consult_wish");

  // ─── STEP 2: 협력점 응대 (consult_active) ───
  console.log("\nSTEP 2 — consult_active (협력점 응대 시작)");
  let r = await updateLeadStatus({
    leadId: lead.id,
    newStatus: "consult_active",
    actorRole: "partner_admin",
    changedById: null,
  });
  if ("error" in r) { console.log("  ✗ 전이 실패:", r.error); fail++; }
  else assertEq("Lead.status", r.lead.status, "consult_active");

  // ─── STEP 3: EnrollmentForm 작성 → form_ready ───
  console.log("\nSTEP 3 — form_ready (가입 신청서 작성)");
  await prisma.enrollmentForm.create({
    data: {
      leadId: lead.id,
      customerName: "E2E 테스트",
      residentRegNumber: "900101-1234567",
      phone: "010-9999-0001",
      address: "서울특별시 강남구 테헤란로 1",
      addressDetail: "101호",
      productCode: PRODUCT_CODE,
      productName: "MEGA ICE 얼음정수기",
      managementMode: "방문형",
      contractPeriod: 60,
      visitInterval: "4개월",
      monthlyPrice: 41900,
      autoDebitBank: "국민은행",
      autoDebitAccount: "123-456-789012",
      autoDebitHolder: "E2E 테스트",
      paymentDayType: "month_end",
      createdByRole: "partner_admin",
    },
  });
  r = await updateLeadStatus({
    leadId: lead.id,
    newStatus: "form_ready",
    actorRole: "partner_admin",
    changedById: null,
  });
  if ("error" in r) { console.log("  ✗ 전이 실패:", r.error); fail++; }
  else assertEq("Lead.status", r.lead.status, "form_ready");

  // ─── STEP 4: 본사 제출 (apply_submitted → verify_pending 자동) ───
  console.log("\nSTEP 4 — apply_submitted (본사 제출, verify_pending 자동 chain)");
  r = await updateLeadStatus({
    leadId: lead.id,
    newStatus: "apply_submitted",
    actorRole: "partner_admin",
    changedById: null,
  });
  if ("error" in r) { console.log("  ✗ 전이 실패:", r.error); fail++; }
  else assertEq("Lead.status (자동 chain 후)", r.lead.status, "verify_pending");

  // ─── STEP 5: 본사 인증 통과 (verify_passed → install_pending 자동) ───
  console.log("\nSTEP 5 — verify_passed (본사 인증, install_pending 자동 chain)");
  r = await updateLeadStatus({
    leadId: lead.id,
    newStatus: "verify_passed",
    actorRole: "hq",
    changedById: null,
  });
  if ("error" in r) { console.log("  ✗ 전이 실패:", r.error); fail++; }
  else assertEq("Lead.status (자동 chain 후)", r.lead.status, "install_pending");

  // 협력점이 install_done 시도 → 거절되어야 함
  console.log("\nSTEP 5b — 협력점이 install_done 시도 (거절 예상)");
  const blockedAttempt = await updateLeadStatus({
    leadId: lead.id,
    newStatus: "install_done",
    actorRole: "partner_admin",
    changedById: null,
  });
  assertTruthy("협력점 install_done 거절", "error" in blockedAttempt);

  // ─── STEP 6: 본사 설치 완료 (install_done → settle_pending + Settlement 생성) ───
  console.log("\nSTEP 6 — install_done (본사 설치 처리, Settlement 자동 생성)");
  r = await updateLeadStatus({
    leadId: lead.id,
    newStatus: "install_done",
    actorRole: "hq",
    changedById: null,
  });
  if ("error" in r) { console.log("  ✗ 전이 실패:", r.error); fail++; }
  else assertEq("Lead.status (자동 chain 후)", r.lead.status, "settle_pending");

  const stm = await prisma.settlement.findUnique({ where: { leadId: lead.id } });
  assertTruthy("Settlement 자동 생성", stm);
  if (stm) {
    assertEq("Settlement.status", stm.status, "pending");
    assertEq("Settlement.productCode", stm.productCode, PRODUCT_CODE);
    assertTruthy("Settlement.baseCommission > 0", stm.baseCommission > 0);
    assertTruthy("Settlement.partnerCommission > 0", stm.partnerCommission > 0);
    console.log(`     baseCommission=${stm.baseCommission} hqMargin=${stm.hqMargin} partnerCommission=${stm.partnerCommission} netPayout=${stm.netPayout}`);
  }

  // ─── STEP 7: 본사 정산 완료 (settle_done + Settlement.status=paid) ───
  console.log("\nSTEP 7 — settle_done (본사 정산 송금 확정)");
  r = await updateLeadStatus({
    leadId: lead.id,
    newStatus: "settle_done",
    actorRole: "hq",
    changedById: null,
  });
  if ("error" in r) { console.log("  ✗ 전이 실패:", r.error); fail++; }
  else assertEq("Lead.status", r.lead.status, "settle_done");

  const stmPaid = await prisma.settlement.findUnique({ where: { leadId: lead.id } });
  assertEq("Settlement.status 자동 paid", stmPaid?.status, "paid");
  assertTruthy("Settlement.paidAt 자동 채움", stmPaid?.paidAt);

  // ─── STEP 8: 환수 시작 → 진행 → 완료 ───
  console.log("\nSTEP 8 — 환수 (refund_pending → progress → done)");
  if (stmPaid) {
    const refundAmount = Math.min(50000, stmPaid.partnerCommission); // 환수 금액
    const r1 = await startRefund({ settlementId: stmPaid.id, amount: refundAmount, reason: "E2E 테스트 환수 — 해지 사은품 환수" });
    if ("error" in r1) { console.log("  ✗ startRefund 실패:", r1.error); fail++; }
    else {
      const s1 = await prisma.settlement.findUnique({ where: { id: stmPaid.id } });
      assertEq("refundStatus", s1?.refundStatus, "refund_pending");
      assertEq("refundAmount", s1?.refundAmount, refundAmount);
    }

    const r2 = await advanceRefund(stmPaid.id);
    if ("error" in r2) { console.log("  ✗ advance progress 실패:", r2.error); fail++; }
    else {
      const s2 = await prisma.settlement.findUnique({ where: { id: stmPaid.id } });
      assertEq("refundStatus (progress)", s2?.refundStatus, "refund_progress");
    }

    const r3 = await advanceRefund(stmPaid.id);
    if ("error" in r3) { console.log("  ✗ advance done 실패:", r3.error); fail++; }
    else {
      const s3 = await prisma.settlement.findUnique({ where: { id: stmPaid.id } });
      assertEq("refundStatus (done)", s3?.refundStatus, "refund_done");
      assertTruthy("refundCompletedAt 자동 채움", s3?.refundCompletedAt);
    }

    // 환수 완료 후 다시 advance 시도 → 거절
    const r4 = await advanceRefund(stmPaid.id);
    assertTruthy("환수 완료 후 추가 advance 거절", "error" in r4);
  }

  // ─── STEP 9: 역전이 (settle_done → install_pending, bypass) → Settlement cancelled ───
  console.log("\nSTEP 9 — 역전이 (settle_done → install_pending, 본사 bypass, Settlement 자동 cancelled)");
  r = await updateLeadStatus({
    leadId: lead.id,
    newStatus: "install_pending",
    actorRole: "hq",
    changedById: null,
    bypassStateMachine: true,
  });
  if ("error" in r) { console.log("  ✗ 역전이 실패:", r.error); fail++; }
  else assertEq("Lead.status (역전이)", r.lead.status, "install_pending");

  const stmCancelled = await prisma.settlement.findUnique({ where: { leadId: lead.id } });
  assertEq("Settlement.status (역전이로 cancelled)", stmCancelled?.status, "cancelled");
  assertTruthy("Settlement.cancelledAt 채움", stmCancelled?.cancelledAt);

  // ─── 정리 ───
  console.log("\n══════ 정리 ══════");
  await prisma.settlement.deleteMany({ where: { leadId: lead.id } });
  await prisma.enrollmentForm.deleteMany({ where: { leadId: lead.id } });
  await prisma.leadStatusLog.deleteMany({ where: { leadId: lead.id } });
  await prisma.lead.delete({ where: { id: lead.id } });
  console.log("  ✓ 테스트 데이터 삭제 완료");

  console.log("\n══════════════════════════════════════");
  console.log(`  결과: ${pass} pass / ${fail} fail`);
  console.log("══════════════════════════════════════");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
