import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { approveCrawledProduct } from "../src/lib/crawler/runner";
import { prisma } from "../src/lib/prisma";

async function main() {
  const pending = await prisma.crawledProduct.findMany({
    where: { approvalStatus: "pending" },
    orderBy: [{ changeType: "asc" }, { name: "asc" }],
    select: { id: true, productCode: true, name: true, changeType: true },
  });
  console.log(`승인 대상 ${pending.length}건`);

  let ok = 0, failed = 0;
  const failures: Array<{ code: string; error: string }> = [];

  for (const p of pending) {
    try {
      await approveCrawledProduct({ crawledId: p.id, reviewerId: null, note: "스크립트 일괄 승인" });
      ok++;
      const tag = p.changeType === "new" ? "🆕" : "✏️";
      console.log(`  ${tag} ${p.productCode?.padEnd(15)} ${p.name}`);
    } catch (e) {
      failed++;
      failures.push({ code: p.productCode ?? "—", error: e instanceof Error ? e.message : String(e) });
    }
  }

  console.log(`\n✅ 승인 완료 ${ok}건 / 실패 ${failed}건`);
  if (failures.length > 0) {
    console.log("\n실패:");
    for (const f of failures) console.log(`  ${f.code}: ${f.error}`);
  }

  // 결과 요약
  const total = await prisma.product.count();
  const withImages = await prisma.product.count({ where: { imageUrls: { isEmpty: false } } });
  console.log(`\n📦 Product 마스터: 총 ${total}개 (이미지 포함 ${withImages}개)`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
