/**
 * Phase 3 검증 — 6월 정책 적용 후 sample dump.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CHECK = [
  "WPUMAC306SWH",  // 투워터 (인하 -75K)
  "WPUIAC506SNS",  // MEGA ICE (인상 60m+)
  "WPUIAC606SSB",  // MEGA ICE mini 신규 컬러
  "MATQM230RSBR",  // 워커힐 스위트 Q (신규 시드)
  "ACL16C2ASKZG",  // 디아트 16평 신형 (신규 시드)
  "MATSD011RFBR",  // placeholder draft (이미지 X)
];

async function main() {
  const total = await prisma.product.count();
  const active = await prisma.product.count({ where: { status: "active" } });
  const draft = await prisma.product.count({ where: { status: "draft" } });
  console.log(`📦 Product: total=${total} active=${active} draft=${draft}\n`);

  for (const code of CHECK) {
    const p = await prisma.product.findUnique({
      where: { productCode: code },
      select: {
        productCode: true, name: true, category: true, status: true,
        rentalPrice: true, baseRentalPrice: true, promoRentalPrice: true, cardDiscountPrice: true,
        imageUrl: true,
      },
    });
    if (!p) { console.log(`${code}: ❌ 없음`); continue; }
    const pol = await prisma.hqPolicy.findFirst({
      where: { product: { productCode: code }, mode: "방문형", contractPeriod: 36 },
      select: { baseCommission: true },
    });
    console.log(`${code} [${p.status}] ${p.category} "${p.name.slice(0, 30)}"`);
    console.log(`   rentalPrice=${p.rentalPrice?.toLocaleString() ?? "—"}  base=${p.baseRentalPrice?.toLocaleString() ?? "—"}  promo=${p.promoRentalPrice?.toLocaleString() ?? "—"}  card=${p.cardDiscountPrice?.toLocaleString() ?? "—"}`);
    console.log(`   img=${p.imageUrl ? "✓" : "✗"}  방문36m 공급가=${pol?.baseCommission?.toLocaleString() ?? "—"}`);
  }

  // priceMatrix 변동 카운트
  const matrixCount = await prisma.priceMatrix.count();
  console.log(`\n📊 PriceMatrix row 총수: ${matrixCount}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
