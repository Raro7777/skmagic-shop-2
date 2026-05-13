/**
 * 한 달치 운영 시나리오 시드 — 정확도 실측용 (14단계 lifecycle)
 *  - 협력점 8곳 + 본사 직영 + 외부 API 채널 3개에서 lead 유입
 *  - 14단계 상태 골고루 분포 (decideStatus 참고)
 *  - 최근 30일 분포로 createdAt 분산
 *  - lifecycle path 에 맞춰 LeadStatusLog chain 자연스럽게 기록
 *  - 설치완료 단계 이후 lead 는 Settlement 생성
 *
 * 식별 prefix: customerName 시작이 "[VS]" — 정리 시 손쉽게 삭제 가능
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NAME_TAG = "[VS]";

// 정리 옵션 — CLI 인자 "clean" 시 기존 시나리오 데이터 삭제 후 종료
const CLEAN_ONLY = process.argv.includes("clean");

const PARTNERS = [
  "gangnam-skmagic", "bucheon-skmagic", "bundang-rental", "jamsil-skmagic",
  "suwon-life", "incheon-life", "gwangju-hq", "daejeon-mid", "hq-direct",
];

const SELLERS_BY_PARTNER: Record<string, string[]> = {
  "gangnam-skmagic": ["park-jimin", "kim-younghee", "lee-junho"],
  "bucheon-skmagic": ["kim-jiho", "yoon-haram"],
  "bundang-rental":  ["lee-yujin"],
  "jamsil-skmagic":  ["ahn-jisoo"],
  "suwon-life":      ["noh-junsung"],
  "incheon-life":    ["yu-saerom"],
  "gwangju-hq":      ["park-yumi"],
  "daejeon-mid":     ["kim-soohyun"],
  "hq-direct":       ["direct-manager"],
};

const API_CHANNELS = ["demo-mall", "water-only", "smart-home"]; // ApiPartner.slug
const API_CATEGORY_LIMIT: Record<string, string[]> = {
  "demo-mall": [],
  "water-only": ["water"],
  "smart-home": ["water", "air", "bidet"],
};

const PRODUCTS = [
  { code: "WPUJCC104SWH", name: "초소형 직수 정수기",  cat: "water" },
  { code: "WPUMAC306SWH", name: "투워터 정수기",       cat: "water" },
  { code: "WPUGBC102SCE", name: "에코미니 정수기 그린41", cat: "water" },
  { code: "ACL15C1ASKWH", name: "15평 올클린 공기청정기", cat: "air" },
  { code: "ACL22C1ASKOB", name: "22평 올클린 디아트 공기청정기", cat: "air" },
  { code: "BIDS17DR64WH", name: "풀스텐 케어 비데",    cat: "bidet" },
  { code: "MATSM430RLWH", name: "워커힐 클라우드 매트리스", cat: "mattress" },
];

const KO_NAMES = [
  "김민지", "박서연", "이준영", "정수아", "최진호", "김다은", "장윤서", "황혜원",
  "오재민", "조현우", "한승민", "유정아", "임소영", "강태욱", "백지영", "송지훈",
  "윤서현", "한지호", "이정민", "노지훈", "한가람", "강현주", "이민혁", "김지혜",
  "정형준", "박유진", "최예린", "이수민", "서지호", "최세빈", "권나윤", "오은서",
  "장형준", "조세희", "임상혁", "차민영", "남궁수", "신이슬", "변지원", "구민호",
];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randPhone(): string {
  const middle = String(Math.floor(Math.random() * 9000) + 1000);
  const last = String(Math.floor(Math.random() * 9000) + 1000);
  return `0102${middle}${last}`;
}
function randRegion(partnerId: string): string {
  const regions: Record<string, string[]> = {
    "gangnam-skmagic": ["강남구 역삼동", "강남구 청담동", "서초구 반포동"],
    "bucheon-skmagic": ["부천시 중동", "부천시 상동"],
    "bundang-rental":  ["성남시 분당구 정자동", "성남시 분당구 야탑동"],
    "jamsil-skmagic":  ["송파구 잠실동", "송파구 가락동"],
    "suwon-life":      ["수원시 영통구 광교동", "수원시 영통구 매탄동"],
    "incheon-life":    ["인천 남동구 구월동", "인천 남동구 만수동"],
    "gwangju-hq":      ["광주 서구 상무동", "광주 서구 화정동"],
    "daejeon-mid":     ["대전 서구 둔산동", "대전 서구 만년동"],
    "hq-direct":       ["서울 종로구", "서울 영등포구", "부산 해운대구", "대구 수성구"],
  };
  return rand(regions[partnerId] ?? ["서울"]);
}

async function clean() {
  const targets = await prisma.lead.findMany({
    where: { customerName: { startsWith: NAME_TAG } },
    select: { id: true },
  });
  const ids = targets.map(t => t.id);
  await prisma.settlement.deleteMany({ where: { leadId: { in: ids } } });
  await prisma.leadStatusLog.deleteMany({ where: { leadId: { in: ids } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  console.log(`✓ ${ids.length}건 시나리오 데이터 정리`);
}

type Scenario = {
  customerName: string;
  phone: string;
  productCode: string;
  productName: string;
  partnerId: string | null;       // null = api 채널
  sellerCode: string | null;
  source: "consumer_form" | "consumer_partner" | "consumer_seller" | "api_partner";
  externalChannel: string | null;
  region: string;
  mode: "방문형" | "셀프형" | null;
  contractPeriod: 36 | 60 | 84;
  rental: number;
  card: number | null;
  rivalCompensation: boolean;
  // 상태 진행 시뮬레이션 — 14단계 라이프사이클
  finalStatus:
    | "consult_wish"     // 신규 미응대
    | "consult_active"   // 상담 진행 중
    | "consult_closed"   // 상담 종료
    | "apply_submitted"  // (자동 chain 으로 verify_pending 까지 가지만 일부만 여기)
    | "verify_pending"   // 인증 대기 (본사 큐)
    | "verify_failed"    // 인증 실패 → 회신 필요
    | "verify_revise"    // 수정 요청 → 회신 필요
    | "revise_resubmit"  // 회신 작성 완료
    | "install_pending"  // 설치 대기
    | "install_done"     // 설치 완료 (정산 진행)
    | "install_cancel"   // 설치 취소
    | "settle_pending"   // 정산 대기
    | "settle_done";     // 정산 완료
  createdAt: Date;
  goingAt: Date | null;       // → consult_active
  applyAt: Date | null;       // → apply_submitted/verify_pending
  verifyDecisionAt: Date | null;  // → verify_passed/failed/revise
  installAt: Date | null;     // → install_done/install_cancel
  settleAt: Date | null;      // → settle_done
  warnAt: Date | null;        // → consult_closed
};

function decideStatus(): Scenario["finalStatus"] {
  const r = Math.random();
  if (r < 0.10) return "consult_wish";       // 10%
  if (r < 0.20) return "consult_active";     // 10%
  if (r < 0.26) return "consult_closed";     // 6%
  if (r < 0.34) return "verify_pending";     // 8% (본사 인증 큐)
  if (r < 0.39) return "verify_failed";      // 5% (회신 필요)
  if (r < 0.43) return "verify_revise";      // 4%
  if (r < 0.48) return "revise_resubmit";    // 5%
  if (r < 0.58) return "install_pending";    // 10% (설치 대기)
  if (r < 0.62) return "install_done";       // 4%
  if (r < 0.65) return "install_cancel";     // 3%
  if (r < 0.78) return "settle_pending";     // 13%
  return "settle_done";                       // 22%
}

function genScenarios(count: number): Scenario[] {
  const out: Scenario[] = [];
  const usedPhones = new Set<string>();
  const now = Date.now();

  let nameIdx = 0;
  for (let i = 0; i < count; i++) {
    const product = rand(PRODUCTS);
    // 카테고리 한도 있는 API 채널 매칭
    let source: Scenario["source"];
    let externalChannel: string | null = null;
    let partnerId: string | null;
    let sellerCode: string | null = null;

    const channelRoll = Math.random();
    if (channelRoll < 0.55) {
      // 협력점 사이트 — 가장 큰 비중
      partnerId = rand(PARTNERS);
      source = "consumer_partner";
      // 30% 영업자 링크
      if (Math.random() < 0.3) {
        const sellers = SELLERS_BY_PARTNER[partnerId] ?? [];
        if (sellers.length > 0) {
          sellerCode = rand(sellers);
          source = "consumer_seller";
        }
      }
    } else if (channelRoll < 0.75) {
      // 공식 사이트 폼
      partnerId = rand(PARTNERS);
      source = "consumer_form";
    } else {
      // 외부 API 채널
      const eligibleChannels = API_CHANNELS.filter(ch => {
        const limits = API_CATEGORY_LIMIT[ch];
        return limits.length === 0 || limits.includes(product.cat);
      });
      externalChannel = rand(eligibleChannels);
      partnerId = null;
      source = "api_partner";
    }

    let phone: string;
    do { phone = randPhone(); } while (usedPhones.has(phone));
    usedPhones.add(phone);

    const createdAt = new Date(now - Math.random() * 30 * DAY);
    const finalStatus = decideStatus();

    // lifecycle step 별 타임스탬프 — 각 단계 사이 1~24h 분포
    let cursor = createdAt.getTime();
    const stepDur = () => (1 + Math.random() * 18) * HOUR;
    const goingAt          = ["consult_active","apply_submitted","verify_pending","verify_failed","verify_revise","revise_resubmit","install_pending","install_done","install_cancel","settle_pending","settle_done"].includes(finalStatus) ? new Date((cursor += stepDur())) : null;
    const applyAt          = ["apply_submitted","verify_pending","verify_failed","verify_revise","revise_resubmit","install_pending","install_done","install_cancel","settle_pending","settle_done"].includes(finalStatus) ? new Date((cursor += stepDur())) : null;
    const verifyDecisionAt = ["verify_failed","verify_revise","revise_resubmit","install_pending","install_done","install_cancel","settle_pending","settle_done"].includes(finalStatus) ? new Date((cursor += stepDur())) : null;
    const installAt        = ["install_done","install_cancel","settle_pending","settle_done"].includes(finalStatus) ? new Date((cursor += stepDur())) : null;
    const settleAt         = ["settle_done"].includes(finalStatus) ? new Date((cursor += 5 * DAY * Math.random() + DAY)) : null;
    const warnAt           = ["consult_closed"].includes(finalStatus) ? new Date(createdAt.getTime() + (Math.random() < 0.4 ? stepDur() * 2 : 0)) : null;

    const mode = Math.random() < 0.5 ? "방문형" : "셀프형";
    const contractPeriod = (Math.random() < 0.7 ? 60 : Math.random() < 0.5 ? 36 : 84) as 36 | 60 | 84;
    const baseRental = 22000 + Math.floor(Math.random() * 35000);
    const card = Math.random() < 0.6 ? Math.floor(baseRental * (0.7 + Math.random() * 0.2)) : null;

    out.push({
      customerName: `${NAME_TAG} ${KO_NAMES[nameIdx++ % KO_NAMES.length]}`,
      phone,
      productCode: product.code,
      productName: product.name,
      partnerId,
      sellerCode,
      source,
      externalChannel,
      region: partnerId ? randRegion(partnerId) : "서울",
      mode,
      contractPeriod,
      rental: baseRental,
      card,
      rivalCompensation: Math.random() < 0.25,
      finalStatus,
      createdAt,
      goingAt,
      applyAt,
      verifyDecisionAt,
      installAt,
      settleAt,
      warnAt,
    });
  }
  return out;
}

async function applyScenario(s: Scenario) {
  // 1) Lead 생성 — 직접 prisma 사용 (captureLead는 중복 판정 + 룰북 ownership 로직이 있어 가상 시나리오엔 부담)
  const sellerRow = s.sellerCode && s.partnerId
    ? await prisma.seller.findUnique({
        where: { partnerId_sellerCode: { partnerId: s.partnerId, sellerCode: s.sellerCode } },
        select: { id: true },
      })
    : null;

  // API 채널 lead 중 설치 완료 이후 단계는 본사 직영(hq-direct)으로 분배한 것으로 시뮬
  const SETTLED_PHASES = new Set(["install_done", "settle_pending", "settle_done", "install_pending"]);
  let effectivePartnerId = s.partnerId;
  let effectiveOwnerType = s.partnerId ? "partner" : "hq_pool";
  if (s.source === "api_partner" && SETTLED_PHASES.has(s.finalStatus)) {
    effectivePartnerId = "hq-direct";
    effectiveOwnerType = "partner";
  }

  const lead = await prisma.lead.create({
    data: {
      customerName: s.customerName,
      phoneRaw: s.phone,
      productInterest: s.productName,
      productCode: s.productCode,
      region: s.region,
      partnerId: effectivePartnerId,
      sellerId: sellerRow?.id ?? null,
      ownerType: effectiveOwnerType,
      source: s.source === "api_partner" ? "api_partner" : "consumer_form",
      externalChannel: s.externalChannel,
      utmSource: s.externalChannel ?? "scenario",
      utmMedium: s.source === "api_partner" ? "api" : "consumer",
      utmCampaign: "monthly-vs",
      status: s.finalStatus,
      selectedMode: s.mode,
      selectedContractPeriod: s.contractPeriod,
      selectedRentalPrice: s.rental,
      selectedCardDiscountPrice: s.card,
      rivalCompensationRequested: s.rivalCompensation,
      createdAt: s.createdAt,
    },
  });

  // 2) LeadStatusLog 기록 — lifecycle path 따라 chain 생성
  const logs: Array<{ prev: string; next: string; at: Date; memo: string }> = [];
  if (s.goingAt) {
    logs.push({ prev: "consult_wish", next: "consult_active", at: s.goingAt, memo: "주문확인 통화 완료" });
  }
  if (s.applyAt) {
    logs.push({ prev: "consult_active", next: "apply_submitted", at: s.applyAt, memo: "고객 신청서 제출" });
    // 자동 chain: apply_submitted → verify_pending
    logs.push({ prev: "apply_submitted", next: "verify_pending", at: new Date(s.applyAt.getTime() + 1000), memo: "[auto chain]" });
  }
  if (s.verifyDecisionAt) {
    if (s.finalStatus === "verify_failed" || s.finalStatus === "revise_resubmit") {
      logs.push({ prev: "verify_pending", next: "verify_failed", at: s.verifyDecisionAt, memo: "본사 인증 실패 — 자격 미달" });
      if (s.finalStatus === "revise_resubmit") {
        logs.push({ prev: "verify_failed", next: "revise_resubmit", at: new Date(s.verifyDecisionAt.getTime() + 3 * HOUR), memo: "영업점 회신 작성" });
      }
    } else if (s.finalStatus === "verify_revise") {
      logs.push({ prev: "verify_pending", next: "verify_revise", at: s.verifyDecisionAt, memo: "본사 보완 요청" });
    } else {
      // verify_passed → install_pending (자동 chain)
      logs.push({ prev: "verify_pending", next: "verify_passed", at: s.verifyDecisionAt, memo: "인증 통과" });
      logs.push({ prev: "verify_passed", next: "install_pending", at: new Date(s.verifyDecisionAt.getTime() + 1000), memo: "[auto chain]" });
    }
  }
  if (s.installAt) {
    if (s.finalStatus === "install_cancel") {
      logs.push({ prev: "install_pending", next: "install_cancel", at: s.installAt, memo: rand(["고객 변심 취소", "설치 일정 불가", "타사 계약 후 취소"]) });
    } else {
      // install_done → settle_pending (자동 chain)
      logs.push({ prev: "install_pending", next: "install_done", at: s.installAt, memo: "설치 완료 + 가입 처리" });
      logs.push({ prev: "install_done", next: "settle_pending", at: new Date(s.installAt.getTime() + 1000), memo: "[auto chain]" });
    }
  }
  if (s.settleAt) {
    logs.push({ prev: "settle_pending", next: "settle_done", at: s.settleAt, memo: "본사 송금 완료" });
  }
  if (s.warnAt) {
    logs.push({
      prev: s.goingAt ? "consult_active" : "consult_wish",
      next: "consult_closed",
      at: s.warnAt,
      memo: rand(["고객 미접수 종료", "타사 계약", "예산 사정", "고객 부재 다중 시도 실패"]),
    });
  }
  if (logs.length > 0) {
    await prisma.leadStatusLog.createMany({
      data: logs.map(l => ({
        leadId: lead.id, previousStatus: l.prev, newStatus: l.next,
        memo: l.memo, createdAt: l.at,
      })),
    });
  }

  // 3) Settlement 생성 — install_done 이후 단계 (partnerId 있는 경우만, API 는 hq-direct 로 분배)
  if (SETTLED_PHASES.has(s.finalStatus) && s.finalStatus !== "install_pending" && s.finalStatus !== "install_cancel" && effectivePartnerId) {
    const product = await prisma.product.findUnique({
      where: { productCode: s.productCode },
      include: { hqPolicy: true },
    });
    if (product?.hqPolicy) {
      const totalCommission = product.hqPolicy.baseCommission + product.hqPolicy.monthIncentive;
      const partnerPolicy = await prisma.partnerPolicy.findUnique({
        where: { partnerId_productId: { partnerId: effectivePartnerId, productId: product.id } },
        select: { giftAmount: true, installAmount: true },
      });
      const giftReturned = partnerPolicy?.giftAmount ?? 0;
      const installReturned = partnerPolicy?.installAmount ?? 0;
      const netPayout = totalCommission - giftReturned - installReturned;
      const settledTime = s.settleAt ?? s.installAt ?? s.createdAt;
      const periodMonth = settledTime.toISOString().slice(0, 7);
      const settleStatus = s.finalStatus === "settle_done" ? "paid"
        : s.finalStatus === "settle_pending" ? (Math.random() < 0.5 ? "confirmed" : "pending")
        : "pending"; // install_done 직후 — 정산 row 만 만들고 대기
      await prisma.settlement.create({
        data: {
          leadId: lead.id,
          partnerId: effectivePartnerId,
          productCode: s.productCode,
          productName: product.name,
          baseCommission: totalCommission,
          giftReturned,
          installReturned,
          netPayout,
          periodMonth,
          status: settleStatus,
          createdAt: s.installAt ?? s.createdAt,
          paidAt: settleStatus === "paid" ? settledTime : null,
        },
      });
    }
  }
}

async function applyRefundScenario(): Promise<{ pending: number; progress: number; done: number }> {
  // settle_done 단계 정산 중 일부에 환수 시나리오 부여
  const candidates = await prisma.settlement.findMany({
    where: {
      lead: { customerName: { startsWith: NAME_TAG }, status: "settle_done" },
      status: "paid",
      refundStatus: null,
    },
    select: { id: true, netPayout: true, createdAt: true },
  });
  const REFUND_REASONS = [
    "고객 해약 — 14일 내 청약 철회",
    "설치 후 불량 — 본사 교환 부담",
    "고객 사망 — 계약 해지",
    "이중 계약 적발",
    "타사 보상 미지급 — 계약 위반",
    "유닛 회수 — 자재 불량",
    "분쟁 — 합의금 별도 청구",
  ];
  // 25% 정도를 환수로
  const refundCount = Math.floor(candidates.length * 0.25);
  const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, refundCount);

  let pending = 0, progress = 0, done = 0;
  for (const c of shuffled) {
    const roll = Math.random();
    const stage = roll < 0.4 ? "refund_pending" : roll < 0.7 ? "refund_progress" : "refund_done";
    const amount = Math.floor(c.netPayout * (0.5 + Math.random() * 0.5)); // 50~100% 환수
    const startedAt = new Date(c.createdAt.getTime() + (3 + Math.random() * 14) * 24 * 60 * 60 * 1000);
    const completedAt = stage === "refund_done"
      ? new Date(startedAt.getTime() + (2 + Math.random() * 10) * 24 * 60 * 60 * 1000)
      : null;
    await prisma.settlement.update({
      where: { id: c.id },
      data: {
        refundStatus: stage,
        refundAmount: amount,
        refundReason: REFUND_REASONS[Math.floor(Math.random() * REFUND_REASONS.length)],
        refundStartedAt: startedAt,
        refundCompletedAt: completedAt,
      },
    });
    if (stage === "refund_pending") pending++;
    else if (stage === "refund_progress") progress++;
    else done++;
  }
  return { pending, progress, done };
}

async function main() {
  if (CLEAN_ONLY) { await clean(); return; }

  await clean(); // 이전 시나리오 데이터 자동 정리
  console.log("");

  const SCENARIO_COUNT = parseInt(process.env.SEED_COUNT ?? "200", 10);
  const scenarios = genScenarios(SCENARIO_COUNT);
  console.log(`📋 ${SCENARIO_COUNT}건 시나리오 생성 → DB 적재 시작\n`);

  let created = 0, errors = 0;
  const dist: Record<string, number> = {};
  const sourceCount = { partner: 0, seller: 0, form: 0, api: 0 };
  for (const s of scenarios) {
    try {
      await applyScenario(s);
      created++;
      dist[s.finalStatus] = (dist[s.finalStatus] ?? 0) + 1;
      if (s.source === "consumer_seller") sourceCount.seller++;
      else if (s.source === "api_partner") sourceCount.api++;
      else if (s.source === "consumer_partner") sourceCount.partner++;
      else sourceCount.form++;
    } catch (e) {
      errors++;
      console.log(`  ⚠ ${s.customerName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`✅ ${created}건 적재 (실패 ${errors})`);
  console.log(`📊 상태 분포:`);
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${k.padEnd(20)} ${v}건`);
  }
  console.log(`📊 채널 분포: 협력점=${sourceCount.partner}  영업자=${sourceCount.seller}  공식폼=${sourceCount.form}  API=${sourceCount.api}`);

  const settleCount = await prisma.settlement.count({
    where: { lead: { customerName: { startsWith: NAME_TAG } } },
  });
  console.log(`💳 Settlement 생성: ${settleCount}건 (설치완료 이후 lead 중 partnerId 있는 항목만)`);

  // 환수 시나리오 부여 (settle_done 의 ~25%)
  const refundDist = await applyRefundScenario();
  console.log(`🔄 환수 시나리오: 예정 ${refundDist.pending}건 · 진행 중 ${refundDist.progress}건 · 완료 ${refundDist.done}건`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
