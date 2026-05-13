/**
 * 운영 진입 전 마진/환원 한도 초기 설정.
 *
 *   1) HqMarginByTier — 4개 티어 모두 fixed ₩20,000
 *   2) Partner — 모든 active 협력점의 sellerMargin = fixed ₩20,000
 *   3) HqPolicy — 모든 옵션의 refundLimitRatio = 1.0 (사은품+설치비 합 ≤ 영업점수수료)
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("─── 1) 티어별 본사마진 = 고정 ₩20,000 ───");
  for (const tier of ["basic", "standard", "premium", "enterprise"]) {
    await prisma.hqMarginByTier.update({
      where: { tier },
      data: { marginType: "fixed", marginAmount: 20000, marginPercent: 0 },
    });
    console.log(`  ✓ ${tier}: fixed ₩20,000`);
  }

  console.log("─── 2) 모든 협력점 영업자마진 = 고정 ₩20,000 ───");
  const partnerUpdate = await prisma.partner.updateMany({
    where: { status: "active" },
    data: { sellerMarginType: "fixed", sellerMarginAmount: 20000, sellerMarginPercent: 0 },
  });
  console.log(`  ✓ ${partnerUpdate.count}개 협력점`);

  console.log("─── 3) HqPolicy.refundLimitRatio = 1.0 (환원 한도 100%) ───");
  const policyUpdate = await prisma.hqPolicy.updateMany({
    data: { refundLimitRatio: 1.0 },
  });
  console.log(`  ✓ ${policyUpdate.count}개 옵션`);

  console.log("\n검증:");
  const tiers = await prisma.hqMarginByTier.findMany({ orderBy: { tier: "asc" } });
  for (const t of tiers) {
    console.log(`  ${t.tier}: ${t.marginType === "fixed" ? "₩" + t.marginAmount.toLocaleString("ko-KR") : (t.marginPercent * 100).toFixed(2) + "%"}`);
  }
  const partner = await prisma.partner.findFirst({ where: { status: "active" } });
  if (partner) {
    console.log(`  ${partner.partnerName}: 영업자마진 ${partner.sellerMarginType === "fixed" ? "₩" + partner.sellerMarginAmount.toLocaleString("ko-KR") : (partner.sellerMarginPercent * 100).toFixed(2) + "%"}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
