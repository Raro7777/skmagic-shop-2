/**
 * SK매직 정수기 카테고리 크롤 → 7월 신규 productCode 의 goodsId + 이미지 URL 확보.
 * 대상: 뉴슬림플러스 5종 + WPUJAC115 D-prefix 2종.
 */
import { skmagicAdapter } from "@/lib/crawler/skmagic";

const TARGETS = new Set([
  "WPUTDC104RNW", "WPUTDF104RNW",
  "WPUTDC114RNW", "WPUTDF114RNW",
  "WPUTDC10RRNW",
  "WPUJAC115DNW", "WPUJAC115DNS",
]);

async function main() {
  console.log(`→ SK매직 크롤 시작 (대상 ${TARGETS.size}종)…`);
  const res = await skmagicAdapter.fetch();
  console.log(`  총 ${res.items.length}개 크롤됨 / warnings=${res.warnings.length}`);

  console.log("\n=== 대상 productCode 매칭 결과 ===");
  for (const target of TARGETS) {
    const hit = res.items.find(r => r.productCode === target);
    if (hit) {
      console.log(`\n✅ ${target}`);
      console.log(`   name: ${hit.name}`);
      console.log(`   modelName: ${hit.modelName}`);
      console.log(`   imageUrl: ${hit.imageUrl}`);
      console.log(`   imageUrls: ${hit.imageUrls?.length ?? 0}개`);
      if (hit.imageUrls?.[0]) console.log(`     first: ${hit.imageUrls[0]}`);
      console.log(`   rentalPrice: ${hit.rentalPrice}`);
      console.log(`   category: ${hit.category}`);
      console.log(`   description: ${(hit.description ?? "").slice(0, 60)}`);
    } else {
      console.log(`\n❌ ${target}  (미발견)`);
    }
  }

  // 미발견 대상은 뭐가 있는지 발견된 것들에서 prefix 로 찾아 힌트
  const found = new Set(res.items.map(r => r.productCode));
  const notFound = [...TARGETS].filter(t => !found.has(t));
  if (notFound.length > 0) {
    console.log(`\n=== 미발견 상품 힌트 (prefix 매칭 발견 상품) ===`);
    for (const t of notFound) {
      const prefix = t.slice(0, 9);
      const hits = res.items.filter(r => r.productCode.startsWith(prefix));
      console.log(`  ${t} → prefix ${prefix} 로 발견된 상품: ${hits.map(h => h.productCode).join(", ") || "없음"}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
