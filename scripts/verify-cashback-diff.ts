/**
 * 4종 모델 방문 60m 의 시트 baseCommission (VAT 제외) vs 앱 캐시백 표시값 vs 차액 확인.
 * 사용자 보고: 시트−앱 = 20만원 ?
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { rentalSupportFor } from "@/lib/rentalSupport";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const TARGETS = ["WPUMAC306SWH", "WPUIAC425SNS", "WPUIAC425SNW", "WPUJAC125SVB"];

const fmt = (n: number) => n.toLocaleString("ko-KR");
const manwon = (n: number) => `${Math.floor(n / 10000)}만원`;

async function main() {
  const partner = await prisma.partner.findUnique({
    where: { partnerCode: "partner-7714c0" },
    select: { rentalSupportAmount: true, rentalSupportEnabled: true },
  });
  const supportAmount = partner?.rentalSupportEnabled ? (partner?.rentalSupportAmount ?? 0) : 0;
  console.log(`▶ partner-7714c0  rentalSupportAmount = ${fmt(supportAmount)}원 (= ${supportAmount/10000}만원)\n`);
  console.log("─".repeat(110));
  console.log(`code            | DB baseCommission   | 시트(만원) | 캐시백 산출       | 앱(만원) | 차액(만원)`);
  console.log("─".repeat(110));

  for (const code of TARGETS) {
    const product = await prisma.product.findUnique({
      where: { productCode: code },
      select: {
        productCode: true,
        hqPolicies: { where: { mode: "방문형", contractPeriod: 60 }, select: { baseCommission: true, monthIncentive: true } },
        partnerPolicies: { where: { partnerId: "partner-7714c0" }, select: { giftAmount: true, installAmount: true } },
      },
    });
    const hq = product?.hqPolicies[0];
    if (!hq) { console.log(`  ${code} HqPolicy 없음`); continue; }
    const pp = product?.partnerPolicies[0];
    const giftAmount = pp?.giftAmount ?? 0;
    const installAmount = pp?.installAmount ?? 0;
    const baseTotal = (hq.baseCommission ?? 0) + (hq.monthIncentive ?? 0);
    const cashback = rentalSupportFor(baseTotal, supportAmount, giftAmount, installAmount);
    const sheetManwon = Math.floor(baseTotal / 10000);
    const appManwon = cashback / 10000;
    const diffManwon = sheetManwon - appManwon;
    console.log(
      `${code.padEnd(15)} | ${fmt(baseTotal).padStart(19)} | ${String(sheetManwon).padStart(9)} | ${fmt(cashback).padStart(17)} | ${String(appManwon).padStart(8)} | ${String(diffManwon).padStart(10)}`,
    );
  }
  console.log("─".repeat(110));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
