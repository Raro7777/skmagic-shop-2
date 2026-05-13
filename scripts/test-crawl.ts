import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runCrawl } from "../src/lib/crawler/runner";
import { prisma } from "../src/lib/prisma";

async function main() {
  // 이전 pending 정리
  const cleared = await prisma.crawledProduct.deleteMany({ where: { approvalStatus: "pending" } });
  if (cleared.count > 0) console.log(`(이전 pending ${cleared.count}건 정리)\n`);

  console.log("→ skmagic 크롤 실행…");
  const result = await runCrawl({ sourceSlug: "skmagic" });

  console.log("\n📦 실행 요약");
  console.log(`  총 수집  : ${result.itemCount}개`);
  console.log(`  신규     : ${result.newCount}개`);
  console.log(`  변경     : ${result.updatedCount}개`);
  console.log(`  변경없음 : ${result.unchangedCount}개`);

  // 샘플 — 신규 1건의 풍부한 필드 확인
  const sample = await prisma.crawledProduct.findFirst({
    where: { runId: result.runId, changeType: "new" },
    orderBy: { name: "asc" },
  });
  if (sample) {
    const raw = (sample.rawData ?? {}) as Record<string, unknown>;
    const imgs = Array.isArray(raw.imageUrls) ? raw.imageUrls.length : 0;
    const features = Array.isArray(raw.keyFeatures) ? raw.keyFeatures : [];
    const specs = (raw.specs && typeof raw.specs === "object" && !Array.isArray(raw.specs))
      ? Object.entries(raw.specs as Record<string, string>) : [];

    console.log(`\n🔍 샘플 (${sample.productCode} — ${sample.name})`);
    console.log(`  imageUrls       : ${imgs}장`);
    console.log(`  keyFeatures (${features.length}): ${features.slice(0, 8).join(", ")}`);
    console.log(`  specs (${specs.length}):`);
    for (const [k, v] of specs.slice(0, 8)) console.log(`     ${k.padEnd(18)} ${v}`);
    console.log(`  warrantyMonths  : ${raw.warrantyMonths ?? "—"}`);
    console.log(`  description     : ${(sample.description ?? "").slice(0, 200)}…`);
  }

  // 변경 항목 통계
  const updated = await prisma.crawledProduct.findMany({
    where: { runId: result.runId, changeType: "updated" },
  });
  if (updated.length > 0) {
    console.log(`\n✏️ 변경 ${updated.length}건 — diff 필드별 카운트`);
    const fieldCounts: Record<string, number> = {};
    for (const u of updated) {
      const prev = (u.previousData ?? {}) as Record<string, unknown>;
      for (const k of Object.keys(prev)) {
        fieldCounts[k] = (fieldCounts[k] ?? 0) + 1;
      }
    }
    for (const [k, c] of Object.entries(fieldCounts)) {
      console.log(`   ${k.padEnd(20)} ${c}건`);
    }
  }

  // 풍부한 필드 통계
  const allRuns = await prisma.crawledProduct.findMany({
    where: { runId: result.runId },
    select: { rawData: true },
  });
  let imgTotal = 0, featTotal = 0, specTotal = 0;
  for (const c of allRuns) {
    const raw = (c.rawData ?? {}) as Record<string, unknown>;
    if (Array.isArray(raw.imageUrls)) imgTotal += raw.imageUrls.length;
    if (Array.isArray(raw.keyFeatures)) featTotal += raw.keyFeatures.length;
    if (raw.specs && typeof raw.specs === "object" && !Array.isArray(raw.specs)) {
      specTotal += Object.keys(raw.specs as object).length;
    }
  }
  console.log(`\n📊 보강 필드 합계 (${allRuns.length}건 기준)`);
  console.log(`   imageUrls 합계   : ${imgTotal}장 (평균 ${(imgTotal / allRuns.length).toFixed(1)})`);
  console.log(`   keyFeatures 합계 : ${featTotal}개 (평균 ${(featTotal / allRuns.length).toFixed(1)})`);
  console.log(`   specs 합계       : ${specTotal}개 (평균 ${(specTotal / allRuns.length).toFixed(1)})`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
