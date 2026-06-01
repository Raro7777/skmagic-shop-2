/**
 * 6월 정책 적용 커버리지 검증 — 모든 active Product 가 정상 갱신됐는지.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const all = await prisma.product.findMany({
    select: { productCode: true, name: true, category: true, status: true,
              rentalPrice: true, baseRentalPrice: true, promoRentalPrice: true,
              cardDiscountPrice: true, priceMatrix: true },
  });
  console.log(`📦 Product 총수: ${all.length}\n`);

  // 카테고리별 활성 + priceMatrix 보유율
  const stats = new Map<string, { total: number; active: number; draft: number;
                                  withMatrix: number; withRental: number; withPromo: number }>();
  for (const p of all) {
    const cat = p.category || "기타";
    const e = stats.get(cat) ?? { total: 0, active: 0, draft: 0, withMatrix: 0, withRental: 0, withPromo: 0 };
    e.total++;
    if (p.status === "active") e.active++;
    if (p.status === "draft") e.draft++;
    if (Array.isArray(p.priceMatrix) && p.priceMatrix.length > 0) e.withMatrix++;
    if (p.rentalPrice && p.rentalPrice > 0) e.withRental++;
    if (p.promoRentalPrice && p.promoRentalPrice > 0) e.withPromo++;
    stats.set(cat, e);
  }

  console.log("=== 카테고리별 통계 ===");
  console.log(`${"카테고리".padEnd(10)} total / active / draft / 가격있음 / promo있음 / matrix있음`);
  for (const [cat, s] of [...stats.entries()].sort()) {
    console.log(`  ${cat.padEnd(10)}  ${s.total.toString().padStart(3)} / ${s.active.toString().padStart(6)} / ${s.draft.toString().padStart(5)} / ${s.withRental.toString().padStart(7)} / ${s.withPromo.toString().padStart(8)} / ${s.withMatrix.toString().padStart(8)}`);
  }

  // ⚠ 이상 케이스: active 인데 rentalPrice=0 또는 priceMatrix 없음
  const broken = all.filter(p =>
    p.status === "active" &&
    (!p.rentalPrice || p.rentalPrice === 0 || !Array.isArray(p.priceMatrix) || p.priceMatrix.length === 0)
  );
  console.log(`\n=== ⚠ active 인데 가격/매트릭스 누락: ${broken.length}개 ===`);
  for (const p of broken.slice(0, 10)) {
    console.log(`  ${p.productCode} (${p.category}) "${p.name.slice(0, 30)}" rentalPrice=${p.rentalPrice} matrix=${Array.isArray(p.priceMatrix) ? p.priceMatrix.length : "X"}`);
  }

  // HqPolicy 커버리지
  const policiesCount = await prisma.hqPolicy.count();
  const productsWithPolicy = await prisma.hqPolicy.groupBy({ by: ["productId"], _count: { _all: true } });
  console.log(`\n=== HqPolicy 커버리지 ===`);
  console.log(`  총 HqPolicy row: ${policiesCount}`);
  console.log(`  HqPolicy 보유 Product: ${productsWithPolicy.length} / ${all.length}`);
  const productIds = new Set(productsWithPolicy.map(p => p.productId));
  const allActiveIds = all.filter(p => p.status === "active").map(p => p.productCode);
  const productMap = new Map(all.map(p => [p.productCode, p]));
  const noPolicy = allActiveIds.filter(code => {
    const p = productMap.get(code);
    return p && !productIds.has(code); // productId 가 Product.id 라 매핑 안 됨, 별도 check
  });

  // 직접 join 으로 확인
  const productsWithPolicyJoined = await prisma.product.findMany({
    where: { status: "active" },
    select: { productCode: true, name: true, category: true, _count: { select: { hqPolicies: true } } },
  });
  const noPol = productsWithPolicyJoined.filter(p => p._count.hqPolicies === 0);
  console.log(`\n  ⚠ active 인데 HqPolicy 0: ${noPol.length}개`);
  for (const p of noPol.slice(0, 10)) {
    console.log(`     ${p.productCode} (${p.category}) "${p.name.slice(0, 30)}"`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
