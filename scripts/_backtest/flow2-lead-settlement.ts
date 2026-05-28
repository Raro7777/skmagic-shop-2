/**
 * Flow 2 — Lead → 정산 백테스트
 *
 * Steps:
 *   1) 컨슈머 Lead 시드 (status=new == consult_wish)
 *   2) going 전환 (consult_wish → consult_active, actor=partner_admin)
 *   3) install_done 전환 — role 가드 점검 (hq 만 가능)
 *   4) Settlement row 자동 생성 (install_done → settle_pending 자동 chain)
 *      산식: baseCommission − hqMargin − giftReturned − installReturned − rentalSupportReturned − (영업자 sellerPayout)
 *   5) settle 전환 (settle_pending → settle_done, hq 만)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
// 동적 import — src/lib/prisma 가 import 시점에 DATABASE_URL 을 읽음
type LeadStatus = "consult_wish" | "consult_active" | "form_ready" | "apply_submitted" | "verify_pending" | "verify_passed" | "install_pending" | "install_done" | "settle_pending" | "settle_done";
type ActorRole = "seller" | "partner_admin" | "hq";
let prisma: any;
let updateLeadStatus: (input: {
  leadId: string; newStatus: LeadStatus; actorRole: ActorRole; changedById: string | null;
  memo?: string; reason?: string; bypassStateMachine?: boolean;
}) => Promise<any>;
const SEED_PREFIX = "backtest-baseline-";

type StepResult = { idx: number; ok: boolean | "warn"; label: string; note?: string };
const results: StepResult[] = [];
const cleanupIds: { type: string; id: string }[] = [];

async function step(idx: number, label: string, fn: () => Promise<StepResult | void>) {
  try {
    const r = await fn();
    if (r) results.push(r);
    else results.push({ idx, ok: true, label });
  } catch (e: any) {
    results.push({ idx, ok: false, label, note: e?.message ?? String(e) });
  }
}

async function main() {
  ({ prisma } = await import("@/lib/prisma"));
  ({ updateLeadStatus } = await import("@/lib/leadStore"));
  const stamp = Date.now().toString(36);
  const leadId = `${SEED_PREFIX}lead-${stamp}`;

  // 시드용 Partner 1개 확보 — 기존 active partner 사용
  const partner = await prisma.partner.findFirst({
    where: { status: "active", partnerCode: { not: "hq-template" } },
    select: { partnerCode: true, partnerName: true },
  });
  if (!partner) {
    console.log("FATAL: active partner 없음");
    process.exit(1);
  }

  // 활성 상품 1개
  const product = await prisma.product.findFirst({
    where: { status: "active" },
    select: { productCode: true, name: true, contractPeriod: true, managementType: true },
  });

  // ─── 1) Lead 시드 ───
  await step(1, "Lead 시드 생성 (consult_wish)", async () => {
    const lead = await prisma.lead.create({
      data: {
        id: leadId,
        customerName: `백테스트고객-${stamp}`,
        phoneRaw: "010-0000-9999",
        productInterest: product?.name ?? "임의상품",
        productCode: product?.productCode ?? null,
        partnerId: partner.partnerCode,
        ownerType: "partner",
        source: "consumer_form",
        status: "consult_wish",
        selectedMode: product?.managementType?.includes("자가") ? "셀프형" : "방문형",
        selectedContractPeriod: product?.contractPeriod ?? 60,
      },
    });
    cleanupIds.push({ type: "Lead", id: lead.id });
    return { idx: 1, ok: true, label: `Lead 생성 (id=${leadId}, partner=${partner.partnerCode})` };
  });

  // ─── 2) consult_wish → consult_active (going) ───
  await step(2, "going 전환 (consult_wish → consult_active)", async () => {
    const r = await updateLeadStatus({
      leadId, newStatus: "consult_active", actorRole: "partner_admin", changedById: null,
    });
    if ("error" in r) return { idx: 2, ok: false, label: "going 전환", note: r.error };
    return { idx: 2, ok: true, label: `going 전환 OK (status=${r.lead.status})` };
  });

  // ─── 3) install_done 시도: 비-hq role 차단 + hq 통과 ───
  await step(3, "install_done role 가드 (hq 전담)", async () => {
    // 우선 lead 를 install_pending 까지 빠르게 끌어올리기 위해 hq bypass 사용
    const setupSteps: Array<{ to: any; }> = [
      { to: "form_ready" },         // EnrollmentForm 없이는 가드 막힘 → bypass 필요
      { to: "apply_submitted" },    // auto chain → verify_pending
      { to: "verify_passed" },      // auto chain → install_pending
    ];
    for (const s of setupSteps) {
      const r = await updateLeadStatus({
        leadId, newStatus: s.to, actorRole: "hq", changedById: null, bypassStateMachine: true,
      });
      if ("error" in r) {
        return { idx: 3, ok: false, label: `install_done setup ${s.to}`, note: r.error };
      }
    }
    // 현재 install_pending 일 것
    const before = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } });
    if (before?.status !== "install_pending") {
      return { idx: 3, ok: "warn", label: `setup 후 상태=${before?.status} (install_pending 기대)` };
    }
    // 비-hq actor 로 install_done 시도 → 차단되어야 함
    const blocked = await updateLeadStatus({
      leadId, newStatus: "install_done", actorRole: "partner_admin", changedById: null,
    });
    const blockedOk = "error" in blocked;
    // hq 로 install_done — auto chain → settle_pending
    const r2 = await updateLeadStatus({
      leadId, newStatus: "install_done", actorRole: "hq", changedById: null,
    });
    if ("error" in r2) {
      return { idx: 3, ok: false, label: "install_done(hq)", note: r2.error };
    }
    return {
      idx: 3,
      ok: blockedOk ? true : "warn",
      label: `partner_admin 차단=${blockedOk}, hq 통과 status=${r2.lead.status}`,
      note: blockedOk ? undefined : "partner_admin 으로 install_done 이 차단되지 않음 — role 가드 누락 의심",
    };
  });

  // ─── 4) Settlement 자동 생성 + 산식 검증 ───
  await step(4, "Settlement 자동 생성 + 산식 검증", async () => {
    const settlement = await prisma.settlement.findUnique({
      where: { leadId },
      select: {
        baseCommission: true, hqMargin: true, partnerCommission: true,
        giftReturned: true, installReturned: true, rentalSupportReturned: true,
        sellerMargin: true, sellerPayout: true, netPayout: true,
        status: true, productCode: true, productName: true,
      },
    });
    if (!settlement) {
      return { idx: 4, ok: false, label: "Settlement row", note: "install_done → settle_pending 자동 chain 후에도 Settlement row 미생성" };
    }
    cleanupIds.push({ type: "Settlement(leadId)", id: leadId });
    const expectedPC = settlement.baseCommission - settlement.hqMargin;
    const pcOk = settlement.partnerCommission === expectedPC;
    // 영업자 없는 케이스 산식: netPayout = partnerCommission - (gift + install + rentalSupport)
    const totalReturned = settlement.giftReturned + settlement.installReturned + settlement.rentalSupportReturned;
    const expectedNet = settlement.sellerMargin === 0
      ? expectedPC - totalReturned
      : settlement.sellerMargin - totalReturned;
    const netOk = settlement.netPayout === expectedNet;
    const detail = `base=${settlement.baseCommission} hqM=${settlement.hqMargin} pc=${settlement.partnerCommission} ret=${totalReturned} sellerM=${settlement.sellerMargin} sellerPayout=${settlement.sellerPayout} net=${settlement.netPayout}`;
    if (pcOk && netOk) {
      return { idx: 4, ok: true, label: `Settlement OK — ${detail}` };
    }
    return {
      idx: 4, ok: "warn",
      label: `Settlement 산식 불일치 (pcOk=${pcOk}, netOk=${netOk})`,
      note: `${detail} / expected pc=${expectedPC} expected net=${expectedNet} — src/lib/marginFlow.ts:computeMarginFlow / src/lib/leadStore.ts:buildSettlementPayload`,
    };
  });

  // ─── 5) settle 전환 (settle_pending → settle_done) ───
  await step(5, "settle 전환 (settle_pending → settle_done)", async () => {
    const blocked = await updateLeadStatus({
      leadId, newStatus: "settle_done", actorRole: "partner_admin", changedById: null,
    });
    const blockedOk = "error" in blocked;
    const r = await updateLeadStatus({
      leadId, newStatus: "settle_done", actorRole: "hq", changedById: null,
    });
    if ("error" in r) return { idx: 5, ok: false, label: "settle_done(hq)", note: r.error };
    const s = await prisma.settlement.findUnique({
      where: { leadId }, select: { status: true, paidAt: true },
    });
    return {
      idx: 5,
      ok: blockedOk && r.lead.status === "settle_done" && s?.status === "paid" ? true : "warn",
      label: `partner_admin 차단=${blockedOk}, lead.status=${r.lead.status}, settlement.status=${s?.status} paidAt=${!!s?.paidAt}`,
    };
  });

  console.log(`\n백테스트 결과 — Flow 2: Lead → 정산\n`);
  const total = results.length;
  for (const r of results) {
    const mark = r.ok === true ? "OK" : r.ok === "warn" ? "WARN" : "FAIL";
    console.log(`[${r.idx}/${total}] ${mark} ${r.label}${r.note ? ` — ${r.note}` : ""}`);
  }
  const fails = results.filter(r => r.ok === false).length;
  const warns = results.filter(r => r.ok === "warn").length;
  const verdict = fails > 0 ? "FAIL" : warns > 0 ? "WARN" : "OK";
  console.log(`\n종합: ${verdict} (fail=${fails} warn=${warns} ok=${total - fails - warns})`);
  console.log(`\n정리 대상 시드:`);
  for (const c of cleanupIds) console.log(`  - ${c.type}: ${c.id}`);
  process.exit(0);
}

main().catch((e) => { console.error("[flow2] FATAL", e); process.exit(1); });
