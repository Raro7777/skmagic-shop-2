/**
 * 3-tier 가격 + 카드할인 + 타사보상 데이터 무결성 audit.
 * - basePrice > rentalPrice > promoPrice (있을 때만) 단조감소?
 * - cardDiscountPrice = (promo ?? rental) - 23,000 매칭?
 * - rivalCompensationPrice 양수?
 * - half-price 기간 0~12 사이?
 * - effective < 23,000 인 경우 (카드할인 음수 → null clamp) 발생?
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const CARD = 23000;
type Opt = {
  mode?: string | null;
  contractPeriod?: number;
  basePrice?: number | null;
  rentalPrice?: number | null;
  promoPrice?: number | null;
  cardDiscountPrice?: number | null;
  rivalCompensationPrice?: number | null;
  rivalCompensationHalfPriceMonths?: number | null;
};

async function main() {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: {
      productCode: true, name: true,
      baseRentalPrice: true, rentalPrice: true, promoRentalPrice: true, cardDiscountPrice: true,
      priceMatrix: true,
    },
  });

  let topLevelMismatch = 0;
  let monotonicViolation = 0;
  let cardDiscountWrong = 0;
  let cardWasted = 0;          // effective ≤ 23k → 카드할인 의미 X
  let rivalSubzero = 0;        // rival − cardDelta < 1,000원 → 너무 공격적 표시
  let halfOutOfRange = 0;
  let baseNullCount = 0;
  let promoNullCount = 0;

  for (const p of products) {
    // Top-level fields 정합성
    const effTop = p.promoRentalPrice ?? p.rentalPrice;
    const expectedCard = Math.max(0, effTop - CARD);
    if (p.cardDiscountPrice !== expectedCard) {
      topLevelMismatch++;
      console.log(`  [top] ${p.productCode}: card=${p.cardDiscountPrice} expected=${expectedCard}`);
    }
    if (p.baseRentalPrice == null) baseNullCount++;
    if (p.promoRentalPrice == null) promoNullCount++;

    // priceMatrix per-option 정합성
    const opts = (p.priceMatrix as unknown as Opt[] | null) ?? [];
    for (const o of opts) {
      const base = o.basePrice ?? null;
      const rental = o.rentalPrice ?? 0;
      const promo = o.promoPrice ?? null;
      const eff = promo ?? rental;
      const card = o.cardDiscountPrice ?? null;
      const expCard = Math.max(0, eff - CARD);

      // 단조감소: base ≥ rental ≥ (promo if exists)
      if (base != null && base < rental) monotonicViolation++;
      if (promo != null && promo > rental) monotonicViolation++;

      // 카드할인 계산 검증
      if (card !== expCard) {
        cardDiscountWrong++;
        if (cardDiscountWrong <= 10) {
          console.log(`  [opt-card] ${p.productCode} ${o.mode}/${o.contractPeriod}m: card=${card} expected=${expCard} (eff=${eff})`);
        }
      }

      // 카드할인 무의미 (effective ≤ 23,000원)
      if (eff > 0 && eff <= CARD) {
        cardWasted++;
        if (cardWasted <= 5) {
          console.log(`  [card-waste] ${p.productCode} ${o.mode}/${o.contractPeriod}m: eff=${eff} ≤ ${CARD} → 카드할인 0`);
        }
      }

      // 타사보상 + 카드 23k stacking → 이후 X원이 너무 작음
      const rival = o.rivalCompensationPrice ?? null;
      if (rival != null && rival > 0 && rival - CARD < 1000) {
        rivalSubzero++;
        if (rivalSubzero <= 5) {
          console.log(`  [rival-low] ${p.productCode} ${o.mode}/${o.contractPeriod}m: rival=${rival}, after-card=${Math.max(0, rival - CARD)}원`);
        }
      }

      // half-price months 범위
      const hm = o.rivalCompensationHalfPriceMonths ?? 0;
      if (hm < 0 || hm > 12) halfOutOfRange++;
    }
  }

  console.log("\n══════ Audit 결과 ══════");
  console.log(`active Product : ${products.length}`);
  console.log(`기준가 누락       : ${baseNullCount}건`);
  console.log(`판촉가 누락       : ${promoNullCount}건 (전사할인 없는 모델)`);
  console.log(`Top-level 카드 불일치 : ${topLevelMismatch}`);
  console.log(`옵션 카드 불일치    : ${cardDiscountWrong}`);
  console.log(`단조감소 위반      : ${monotonicViolation}`);
  console.log(`카드할인 무효 옵션 : ${cardWasted} (effective ≤ ${CARD}원)`);
  console.log(`타사+카드 ≈ 0     : ${rivalSubzero} (rival − 23k < 1,000)`);
  console.log(`반값 개월 이상치  : ${halfOutOfRange}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
