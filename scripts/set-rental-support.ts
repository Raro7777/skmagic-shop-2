import { prisma } from "../src/lib/prisma";
import { rentalSupportFor } from "../src/lib/rentalSupport";
import { computeHqMargin } from "../src/lib/marginFlow";

async function main() {
  console.log("─── 인터넷끝판왕 rentalSupportAmount = ₩200,000 ───");
  const updated = await prisma.partner.update({
    where: { partnerCode: "partner-7714c0" },
    data: { rentalSupportAmount: 200000 },
    select: { partnerName: true, rentalSupportAmount: true, tier: true },
  });
  console.log(`  ✓ ${updated.partnerName} · rentalSupportAmount = ₩${updated.rentalSupportAmount.toLocaleString("ko-KR")}`);
  console.log(`  티어: ${updated.tier}`);

  console.log("\n─── 인터넷끝판왕 상품별 렌탈지원금 실표시 시뮬레이션 ───");
  console.log("  (사은품 0 / 설치 0 가정 — 협력점 정책 미설정 상태에서의 최대 한도)");

  const tierMarginRow = await prisma.hqMarginByTier.findUnique({ where: { tier: updated.tier } });
  const tierMargin = tierMarginRow
    ? { type: tierMarginRow.marginType as "fixed" | "percent", amount: tierMarginRow.marginAmount, percent: tierMarginRow.marginPercent }
    : null;

  const products = await prisma.product.findMany({
    where: { status: "active" },
    include: { hqPolicies: true },
    take: 5,
    orderBy: { name: "asc" },
  });

  for (const p of products) {
    const opt = p.hqPolicies.find(h => h.mode === "방문형" && h.contractPeriod === 60) ?? p.hqPolicies[0];
    if (!opt) continue;
    const base = opt.baseCommission + opt.monthIncentive;
    const hqMargin = computeHqMargin(base, opt, tierMargin);
    const partnerCommission = base - hqMargin;
    const support = rentalSupportFor(partnerCommission, 200000, 0, 0);
    const status = support > 0 ? "✓ 표시됨" : "⚠ 한도 부족 → 0";
    console.log(`  ${p.name} [${p.productCode}]`);
    console.log(`    영업점수수료 ₩${partnerCommission.toLocaleString("ko-KR")} → 렌탈지원금 표시 ₩${support.toLocaleString("ko-KR")} (${status})`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
