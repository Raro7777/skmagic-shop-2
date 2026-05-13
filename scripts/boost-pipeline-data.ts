/**
 * 일회성 데모 부스터:
 * - 모든 파트너에 lead가 골고루 들어가도록 추가 시드
 * - 일부 lead를 going/done/warn으로 진행 + LeadStatusLog 동반 생성
 * - source 다양화 (kakao/phone/consumer_form)
 *
 * 멱등성: 동일 phoneRaw + customerName 조합이 이미 있으면 스킵.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const HOUR = 60 * 60 * 1000;

type Seed = {
  partnerId: string;
  customerName: string;
  phoneRaw: string;
  productInterest: string;
  productCode?: string;
  region?: string;
  source: string;
  status: "consult_wish" | "consult_active" | "settle_done" | "consult_closed";
  ageHours: number; // 이 시간 전에 createdAt
  memo?: string;
};

const SEEDS: Seed[] = [
  // 강남 — 진행/완료/보류 다양화 (기존 10개 신규 외에 추가)
  { partnerId: "gangnam-skmagic", customerName: "정유나",   phoneRaw: "01045671234", productInterest: "초소형 직수 정수기",      productCode: "WPUJCC104SWH", region: "서초구 잠원동",  source: "kakao",         status: "consult_active", ageHours: 26, memo: "주문확인 통화 완료, 5/12 오후 설치 예정" },
  { partnerId: "gangnam-skmagic", customerName: "최강민",   phoneRaw: "01067894455", productInterest: "투워터 정수기",            productCode: "WPUMAC306SWH", region: "강남구 청담동",  source: "phone",         status: "consult_active", ageHours: 50, memo: "설치 일정 조율 중 (5/14 오전 희망)" },
  { partnerId: "gangnam-skmagic", customerName: "한지원",   phoneRaw: "01023455678", productInterest: "에코미니 정수기 그린41",   productCode: "WPUGBC102SCE", region: "강남구 신사동",  source: "consumer_form", status: "settle_done",  ageHours: 96, memo: "설치 완료 — 정산 대기" },
  { partnerId: "gangnam-skmagic", customerName: "송미경",   phoneRaw: "01034567788", productInterest: "풀스텐 케어 비데",         productCode: "BIDS17DR64WH", region: "강남구 압구정",  source: "kakao",         status: "settle_done",  ageHours: 120, memo: "설치 완료" },
  { partnerId: "gangnam-skmagic", customerName: "권민호",   phoneRaw: "01098765432", productInterest: "15평 올클린 공기청정기",   productCode: "ACL15C1ASKWH", region: "서초구 방배동",  source: "consumer_form", status: "consult_closed",  ageHours: 18, memo: "고객 부재 — 5/11 재시도 예정" },

  // 부천 — 다양한 status로 신규 시작
  { partnerId: "bucheon-skmagic", customerName: "이수진",   phoneRaw: "01012348877", productInterest: "초소형 직수 정수기",      productCode: "WPUJCC104SWH", region: "부천시 중동",   source: "consumer_form", status: "consult_wish",   ageHours: 0.5 },
  { partnerId: "bucheon-skmagic", customerName: "김도현",   phoneRaw: "01044556677", productInterest: "에코미니 정수기 그린41",   productCode: "WPUGBC102SCE", region: "부천시 상동",   source: "kakao",         status: "consult_wish",   ageHours: 5 },
  { partnerId: "bucheon-skmagic", customerName: "박재현",   phoneRaw: "01055667788", productInterest: "투워터 정수기",            productCode: "WPUMAC306SWH", region: "부천시 원미",   source: "phone",         status: "consult_active", ageHours: 30, memo: "주문확인 완료, 5/13 설치 예정" },
  { partnerId: "bucheon-skmagic", customerName: "오은서",   phoneRaw: "01066778899", productInterest: "풀스텐 케어 비데",         productCode: "BIDS17DR64WH", region: "부천시 송내",   source: "consumer_form", status: "settle_done",  ageHours: 72, memo: "설치 완료" },
  { partnerId: "bucheon-skmagic", customerName: "장형준",   phoneRaw: "01077889900", productInterest: "15평 올클린 공기청정기",   productCode: "ACL15C1ASKWH", region: "부천시 역곡",   source: "kakao",         status: "consult_closed",  ageHours: 14, memo: "이미 타사 계약 — 보류" },

  // 분당 — 신규 위주
  { partnerId: "bundang-rental",  customerName: "윤가람",   phoneRaw: "01088990011", productInterest: "초소형 직수 정수기",      productCode: "WPUJCC104SWH", region: "분당구 정자동",  source: "consumer_form", status: "consult_wish",   ageHours: 1 },
  { partnerId: "bundang-rental",  customerName: "조세희",   phoneRaw: "01099001122", productInterest: "에코미니 정수기 그린41",   productCode: "WPUGBC102SCE", region: "분당구 서현동",  source: "kakao",         status: "consult_wish",   ageHours: 8 },
  { partnerId: "bundang-rental",  customerName: "임상혁",   phoneRaw: "01011223344", productInterest: "풀스텐 케어 비데",         productCode: "BIDS17DR64WH", region: "분당구 야탑",   source: "phone",         status: "consult_active", ageHours: 38, memo: "5/14 오후 설치" },
  { partnerId: "bundang-rental",  customerName: "차민영",   phoneRaw: "01022334455", productInterest: "15평 올클린 공기청정기",   productCode: "ACL15C1ASKWH", region: "분당구 미금",   source: "consumer_form", status: "settle_done",  ageHours: 100, memo: "설치 완료 — 후기 남김" },
];

async function main() {
  let created = 0;
  let logsCreated = 0;
  let skipped = 0;

  for (const s of SEEDS) {
    const exists = await prisma.lead.findFirst({
      where: { phoneRaw: s.phoneRaw, customerName: s.customerName },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    const createdAt = new Date(Date.now() - s.ageHours * HOUR);
    const lead = await prisma.lead.create({
      data: {
        customerName: s.customerName,
        phoneRaw: s.phoneRaw,
        productInterest: s.productInterest,
        productCode: s.productCode ?? null,
        region: s.region ?? null,
        partnerId: s.partnerId,
        ownerType: "partner",
        source: s.source,
        status: s.status,
        createdAt,
      },
    });
    created++;

    // status 진행 이력 시뮬레이션 (14단계 chain 축약 버전)
    if (s.status === "consult_active") {
      const goingAt = new Date(createdAt.getTime() + s.ageHours * HOUR * 0.3);
      await prisma.leadStatusLog.create({
        data: { leadId: lead.id, previousStatus: "consult_wish", newStatus: "consult_active", memo: "주문확인 완료", createdAt: goingAt },
      });
      logsCreated++;
    } else if (s.status === "consult_closed") {
      const closedAt = new Date(createdAt.getTime() + s.ageHours * HOUR * 0.3);
      await prisma.leadStatusLog.create({
        data: { leadId: lead.id, previousStatus: "consult_wish", newStatus: "consult_closed", memo: s.memo ?? "미접수 종료", createdAt: closedAt },
      });
      logsCreated++;
    } else if (s.status === "settle_done") {
      // chain: consult_wish → consult_active → apply_submitted → verify_pending → verify_passed → install_pending → install_done → settle_pending → settle_done
      const base = createdAt.getTime();
      const dur = s.ageHours * HOUR;
      const stepAt = (frac: number) => new Date(base + dur * frac);
      const chain: Array<[string, string, number, string]> = [
        ["consult_wish",    "consult_active",  0.10, "주문확인 완료"],
        ["consult_active",  "apply_submitted", 0.20, "고객 신청서 제출"],
        ["apply_submitted", "verify_pending",  0.21, "[auto chain]"],
        ["verify_pending",  "verify_passed",   0.30, "인증 통과"],
        ["verify_passed",   "install_pending", 0.31, "[auto chain]"],
        ["install_pending", "install_done",    0.55, s.memo ?? "설치 완료"],
        ["install_done",    "settle_pending",  0.56, "[auto chain]"],
        ["settle_pending",  "settle_done",     0.85, "본사 송금 완료"],
      ];
      for (const [prev, next, frac, memo] of chain) {
        await prisma.leadStatusLog.create({
          data: { leadId: lead.id, previousStatus: prev, newStatus: next, memo, createdAt: stepAt(frac) },
        });
        logsCreated++;
      }

      // Settlement 생성
      if (s.productCode) {
        const product = await prisma.product.findUnique({
          where: { productCode: s.productCode },
          include: { hqPolicy: true },
        });
        if (product?.hqPolicy) {
          const installTime = stepAt(0.55);
          const periodMonth = `${installTime.getFullYear()}-${String(installTime.getMonth() + 1).padStart(2, "0")}`;
          await prisma.settlement.create({
            data: {
              leadId: lead.id,
              partnerId: s.partnerId,
              productCode: s.productCode,
              productName: product.name,
              baseCommission: product.hqPolicy.baseCommission,
              giftReturned: 0,
              installReturned: 0,
              netPayout: product.hqPolicy.baseCommission,
              periodMonth,
              status: "paid",
              createdAt: installTime,
              paidAt: stepAt(0.85),
            },
          });
        }
      }
    }
  }

  console.log(`✓ Lead 생성 ${created}건 / 스킵 ${skipped}건`);
  console.log(`✓ LeadStatusLog 생성 ${logsCreated}건`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
