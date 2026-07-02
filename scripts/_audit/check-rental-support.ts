import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const p = await prisma.partner.findUnique({
    where: { partnerCode: "partner-7714c0" },
    select: { partnerCode: true, partnerName: true, rentalSupportEnabled: true, rentalSupportAmount: true, brandSafeMode: true, tier: true },
  });
  console.log("[partner-7714c0]");
  console.log(`  rentalSupportEnabled = ${p?.rentalSupportEnabled}`);
  console.log(`  rentalSupportAmount  = ${p?.rentalSupportAmount}`);
  console.log(`  brandSafeMode        = ${p?.brandSafeMode}`);
  console.log(`  tier                 = ${p?.tier}`);
  console.log();

  const sellers = await prisma.seller.findMany({
    where: { partnerId: "partner-7714c0" },
    select: { sellerCode: true, name: true, status: true },
  });
  console.log(`[sellers under partner-7714c0]`);
  for (const s of sellers) console.log(`  ${s.sellerCode.padEnd(15)} ${s.name.padEnd(20)} [${s.status}]`);

  // 유효 여부 시뮬
  const bs = p?.brandSafeMode ?? false;
  const en = p?.rentalSupportEnabled ?? false;
  const amt = p?.rentalSupportAmount ?? 0;
  console.log();
  console.log("[시뮬레이션 — 상세페이지 렌탈지원금 노출 조건]");
  console.log(`  컨슈머 메인 (sellerCode 없음): ${bs && !"" ? "❌ brandSafeMode 차단" : en && amt > 0 ? "✅ 노출" : "❌ enabled 또는 amount 0"}`);
  console.log(`  영업자 페이지 (sellerCode 있음): ${en && amt > 0 ? "✅ 노출 (금액 > 0)" : `❌ enabled=${en} / amount=${amt}`}`);

  await prisma.$disconnect();
}
main();
