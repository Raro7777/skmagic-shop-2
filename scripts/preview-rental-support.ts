import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PARTNER = "partner-7714c0"; // 인터넷끝판왕
const TARGETS = ["WPUIAC506SNS", "WPUMAC306SWH", "WPUJAC115SNW"]; // 메가 아이스 / 투워터 / 초소형 플러스

type PriceOption = {
  mode: "방문형" | "셀프형" | null;
  contractPeriod: number;
  visitInterval?: string;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  baseCommission: number | null;
  rivalCompensationPrice?: number | null;
  rivalCompensationHalfPriceMonths?: number | null;
};

const fmt = (n: number) => n.toLocaleString("ko-KR");

async function main() {
  for (const code of TARGETS) {
    const p = await prisma.product.findUnique({
      where: { productCode: code },
      include: {
        hqPolicy: true,
        partnerPolicies: { where: { partnerId: PARTNER } },
      },
    });
    if (!p) { console.log(`! ${code} not found`); continue; }

    const pp = p.partnerPolicies[0];
    const giftAmount = pp?.giftAmount ?? 0;
    const installAmount = pp?.installAmount ?? 0;
    const monthIncentive = p.hqPolicy?.monthIncentive ?? 0;

    const matrix = (p.priceMatrix as unknown as PriceOption[]) ?? [];

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${code} — ${p.name}`);
    console.log(`기존 환원: 사은품 ₩${fmt(giftAmount)} / 설치비 ₩${fmt(installAmount)}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // 운영방식·약정 별로 시뮬
    for (const opt of matrix) {
      const rental = opt.rentalPrice;
      const card = opt.cardDiscountPrice ?? rental;
      const rival = opt.rivalCompensationPrice ?? null;
      const base = (opt.baseCommission ?? 0) + monthIncentive; // 수수료 합계 = baseCommission + monthIncentive
      const usedByGiftInstall = giftAmount + installAmount;
      const maxRentalSupport = Math.max(0, base - usedByGiftInstall); // 한도 = 수수료 - (사은품+설치)

      // 월별 분배 (총액 N원을 contractPeriod 로 나눠 월 환산 표시)
      const monthlyShare = Math.floor(maxRentalSupport / opt.contractPeriod);

      // 최종 노출가 = (카드할인가 또는 운영가) - 월 렌탈지원금
      const baseUnitWithCard = card;
      const baseUnitWithRival = rival ?? rental;
      const finalCard = Math.max(0, baseUnitWithCard - monthlyShare);
      const finalRival = rival ? Math.max(0, baseUnitWithRival - monthlyShare) : null;

      console.log(
        `\n  [${opt.mode}·${opt.contractPeriod}개월·${opt.visitInterval ?? ""}]`
      );
      console.log(
        `    운영가 ₩${fmt(rental)} · 카드할인가 ₩${fmt(card)}` +
        (rival ? ` · 타사보상가 ₩${fmt(rival)}` : "") +
        ` · 수수료합계 ₩${fmt(base)}`
      );
      console.log(
        `    └ 협력점 렌탈지원 한도(최대): ₩${fmt(maxRentalSupport)} ` +
        `(= 수수료 ${fmt(base)} − 사은품 ${fmt(giftAmount)} − 설치 ${fmt(installAmount)})`
      );
      console.log(
        `    └ 약정 ${opt.contractPeriod}개월 분배 시: 월 ₩${fmt(monthlyShare)} 환산`
      );
      console.log(
        `    └ 노출가 = 카드할인가 ₩${fmt(card)} − 월 ₩${fmt(monthlyShare)} ` +
        `= ₩${fmt(finalCard)}/월` +
        (rival ? `  |  타사보상가 ₩${fmt(rival)} − 월 ₩${fmt(monthlyShare)} = ₩${fmt(finalRival ?? 0)}/월` : "")
      );
    }
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
