import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const URL = "postgresql://neondb_owner:npg_lXZuHR1ykc4q@ep-solitary-mouse-aozju89o-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL }) });

  // 1) MEGA ICE mini (WPUIAC606) 존재?
  const mini = await prisma.product.findMany({
    where: { productCode: { startsWith: "WPUIAC606" } },
    select: { productCode: true, name: true, status: true, priceMatrix: true },
  });
  console.log("[1] MEGA ICE mini (WPUIAC606):", mini.length, "개");
  for (const m of mini) console.log(`    - ${m.productCode}  ${m.name}  [${m.status}]`);

  // 2) MEGA ICE (WPUIAC506) 7년 방문 타사보상 가격 → 6월 = 42,500 / 5월 = 43,500
  const mega = await prisma.product.findFirst({
    where: { productCode: { startsWith: "WPUIAC506" } },
    select: { productCode: true, name: true, priceMatrix: true },
  });
  if (mega) {
    type Opt = { mode: string | null; contractPeriod: number; rivalCompensationPrice?: number | null };
    const opts = mega.priceMatrix as unknown as Opt[];
    const visit84 = opts?.find(o => (o.mode === "방문형" || o.mode === null) && o.contractPeriod === 84);
    console.log(`\n[2] MEGA ICE 84개월 방문 타사보상 = ${visit84?.rivalCompensationPrice ?? "—"}  (6월=42500 / 5월=43500)`);
  } else {
    console.log("\n[2] MEGA ICE (WPUIAC506) 모델 없음");
  }

  // 3) 임의 product 의 priceMatrix 에 rivalCompensationPrice 가 있는지 (5월 작업 적용 여부)
  const sample = await prisma.product.findFirst({
    where: { productCode: { startsWith: "WPUIAC414" } },
    select: { productCode: true, priceMatrix: true },
  });
  if (sample) {
    type Opt = { mode: string | null; contractPeriod: number; rivalCompensationPrice?: number | null; rivalCompensationHalfPriceMonths?: number | null };
    const opts = sample.priceMatrix as unknown as Opt[];
    const hasRival = opts?.some(o => o.rivalCompensationPrice != null);
    console.log(`[3] WPUIAC414 (원코크 얼음물) — rivalCompensationPrice 적용 여부: ${hasRival ? "✅" : "❌"}`);
  }

  // 4) PartnerProductPromotion — 등록된 프로모션 수
  const promos = await prisma.partnerProductPromotion.findMany({
    select: { partnerId: true, productCode: true, enabled: true, badgeText: true },
  });
  console.log(`\n[4] PartnerProductPromotion (2번 DB): ${promos.length} 건`);
  for (const p of promos.slice(0, 10)) console.log(`    - ${p.partnerId} / ${p.productCode} / ${p.enabled ? "ON" : "OFF"} / "${p.badgeText}"`);

  // 5) Partner 수
  const partnerCount = await prisma.partner.count();
  console.log(`\n[5] Partner 수: ${partnerCount}`);

  // 6) Product 총 수
  const productCount = await prisma.product.count();
  console.log(`[6] Product 수 (전체): ${productCount}`);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
