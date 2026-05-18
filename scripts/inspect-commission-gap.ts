/**
 * 본사 정책서 (시트) baseCommission 과 앱 표시 partnerCommission 의 차액 분석.
 *
 * 시트 정책 (HqPolicy.baseCommission + monthIncentive) 60 vs 앱 표시 46 → 차액 14
 * → hqMargin 14? rentalSupport 14? tier 마진? 출처 추적.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const fmt = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("ko-KR");

const TARGETS = [
  { code: "WPUMAC306SWH", mode: "방문형", cp: 60 },
  { code: "WPUIAC425SNS", mode: "방문형", cp: 60 },
  { code: "WPUIAC425SNW", mode: "방문형", cp: 60 },
  { code: "WPUJAC125SVB", mode: "방문형", cp: 60 },
];

async function main() {
  const partner = await prisma.partner.findUnique({
    where: { partnerCode: "partner-7714c0" },
    select: { partnerCode: true, partnerName: true, tier: true, rentalSupportEnabled: true, rentalSupportAmount: true },
  });
  console.log(`Partner: ${partner?.partnerCode} (${partner?.partnerName}) · tier=${partner?.tier}`);
  console.log(`  rentalSupport: enabled=${partner?.rentalSupportEnabled}  amount=${fmt(partner?.rentalSupportAmount)}원\n`);

  const tierMargin = await prisma.hqMarginByTier.findUnique({ where: { tier: partner?.tier ?? "basic" } });
  console.log(`Tier 마진 (${partner?.tier}): type=${tierMargin?.marginType} amount=${fmt(tierMargin?.marginAmount)} percent=${tierMargin?.marginPercent}\n`);

  console.log("─".repeat(130));
  console.log("productCode      mode    cp  | baseCommission  monthIncentive  baseTotal | hqMargin | partnerCommission | rentalSupport한도 | netPayout");
  console.log("─".repeat(130));

  for (const t of TARGETS) {
    const product = await prisma.product.findUnique({
      where: { productCode: t.code },
      select: {
        id: true, name: true,
        hqPolicies: {
          where: { mode: t.mode, contractPeriod: t.cp },
          select: { mode: true, contractPeriod: true, baseCommission: true, monthIncentive: true, marginType: true, marginAmount: true, marginPercent: true, installSubsidy: true, refundLimitRatio: true },
        },
        partnerPolicies: {
          where: { partnerId: "partner-7714c0" },
          select: { giftAmount: true, installAmount: true },
        },
      },
    });
    if (!product) { console.log(`  ${t.code} not found`); continue; }
    const hq = product.hqPolicies[0];
    if (!hq) { console.log(`  ${t.code} (${t.mode}/${t.cp}m) HqPolicy 없음`); continue; }

    const base = (hq.baseCommission ?? 0);
    const incentive = (hq.monthIncentive ?? 0);
    const baseTotal = base + incentive;

    // HQ 마진 — 정책 내장(marginAmount/Percent) 우선, 없으면 Tier 기본
    let hqMargin = 0;
    let marginSource = "";
    if (hq.marginType === "fixed" && (hq.marginAmount ?? 0) > 0) {
      hqMargin = hq.marginAmount ?? 0;
      marginSource = `정책내장(fixed)`;
    } else if (hq.marginType === "percent" && (hq.marginPercent ?? 0) > 0) {
      hqMargin = Math.floor(baseTotal * (hq.marginPercent ?? 0) / 100);
      marginSource = `정책내장(${hq.marginPercent}%)`;
    } else if (tierMargin?.marginType === "fixed") {
      hqMargin = tierMargin.marginAmount ?? 0;
      marginSource = `tier(fixed)`;
    } else if (tierMargin?.marginType === "percent") {
      hqMargin = Math.floor(baseTotal * (tierMargin.marginPercent ?? 0) / 100);
      marginSource = `tier(${tierMargin.marginPercent}%)`;
    }

    const partnerCommission = baseTotal - hqMargin;
    const pp = product.partnerPolicies[0];
    const giftAmount = pp?.giftAmount ?? 0;
    const installAmount = pp?.installAmount ?? 0;
    const rentalSupport = partner?.rentalSupportEnabled ? Math.min(partner?.rentalSupportAmount ?? 0, Math.max(0, partnerCommission - giftAmount - installAmount)) : 0;
    const netPayout = partnerCommission - giftAmount - installAmount - rentalSupport;

    console.log(
      `${t.code.padEnd(16)} ${t.mode.padEnd(6)} ${String(t.cp).padStart(3)} | ` +
      `${fmt(base).padStart(13)} ${fmt(incentive).padStart(15)} ${fmt(baseTotal).padStart(9)} | ` +
      `${fmt(hqMargin).padStart(8)} | ${fmt(partnerCommission).padStart(17)} | ${fmt(rentalSupport).padStart(17)} | ${fmt(netPayout)}`,
    );
    console.log(`                                  hqMargin 출처: ${marginSource}, gift=${fmt(giftAmount)}, install=${fmt(installAmount)}`);
  }
  console.log("─".repeat(130));
  console.log("\n해석:");
  console.log("  · baseTotal       = HqPolicy.baseCommission + monthIncentive  (= 시트 정책서 영업점수수료)");
  console.log("  · hqMargin        = 정책서 본사 마진 (or Tier 마진)");
  console.log("  · partnerCommission = baseTotal − hqMargin  (= 협력점 통상 수령)");
  console.log("  · rentalSupport한도  = 협력점이 고객에게 환원할 캐시백 (메인 카드 +X만원 표시)");
  console.log("  · netPayout       = partnerCommission − 사은품 − 설치비 − 렌탈지원금");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
