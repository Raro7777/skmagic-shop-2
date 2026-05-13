/**
 * 진열 정렬 룰 검증
 *
 *   기본(displayConfig 비어있을 때) 정렬:
 *     - 메인 picks/hero: 영업점수수료(partnerCommission) DESC
 *     - 카테고리별 ranking / 카테고리 페이지: 사은품 DESC + 수수료 DESC tie-break
 *   협력점이 displayConfig 로 명시한 순서가 있으면 그것을 최우선.
 */
import { getPartnerSite, listPartnerProducts } from "../src/lib/partnerSite";
import { prisma } from "../src/lib/prisma";

async function main() {
  const partnerCode = "partner-7714c0";
  console.log("===== 진열 정렬 검증 =====\n");

  // displayConfig 의 영향 확인
  const partner = await prisma.partner.findUnique({ where: { partnerCode }, select: { displayConfig: true, tier: true } });
  console.log(`tier: ${partner?.tier}`);
  console.log(`displayConfig: ${JSON.stringify(partner?.displayConfig)}\n`);

  const site = await getPartnerSite(partnerCode);
  if (!site) { console.log("⚠ partner site 미발견"); return; }

  console.log("[메인 picks/hero — 영업점수수료 높은 순 fallback]");
  console.log(`  Hero: ${site.hero?.name ?? "(없음)"}`);
  console.log("  Picks (4개):");
  site.picks.forEach((p, i) => console.log(`    ${i + 1}. ${p.name} (${p.category})`));

  console.log("\n[카테고리별 랭킹 — 사은품 높은 순 fallback]");
  for (const [cat, items] of Object.entries(site.rankingsByCategory)) {
    console.log(`  ${cat}:`);
    items.slice(0, 4).forEach((p, i) =>
      console.log(`    ${i + 1}. ${p.name}  사은품 ₩${p.giftAmount.toLocaleString("ko-KR")}`)
    );
  }

  console.log("\n[카테고리 페이지 — listPartnerProducts(category=water)]");
  const waterPage = await listPartnerProducts(partnerCode, { category: "water" });
  waterPage.slice(0, 5).forEach((p, i) =>
    console.log(`    ${i + 1}. ${p.name}  사은품 ₩${p.giftAmount.toLocaleString("ko-KR")}`)
  );

  console.log("\n[전체 목록 — listPartnerProducts() = 영업점수수료 높은 순]");
  const allProducts = await listPartnerProducts(partnerCode);
  allProducts.slice(0, 5).forEach((p, i) =>
    console.log(`    ${i + 1}. ${p.name}  사은품 ₩${p.giftAmount.toLocaleString("ko-KR")}`)
  );
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
