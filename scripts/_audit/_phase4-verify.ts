/**
 * Phase 4 — 종합 검증.
 *  - priceMatrix 중복 0건
 *  - modelName == productCode 19/19
 *  - imageUrl null/공백 카운트
 *  - HTTP 검증 sample (외부 의존이라 콘솔 노트만 출력)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`\n=== Phase 4: 종합 검증 ===\n`);

  const seeded = await prisma.product.findMany({
    where: { description: { contains: "[seeded from" } },
    select: { productCode: true, name: true, modelName: true, imageUrl: true, priceMatrix: true, status: true },
    orderBy: { productCode: "asc" },
  });
  console.log(`시드 Product: ${seeded.length}개\n`);

  // 1) priceMatrix 중복 검사
  let dupCount = 0;
  for (const p of seeded) {
    const mat = (p.priceMatrix as Array<Record<string, unknown>> | null) ?? [];
    if (!Array.isArray(mat) || mat.length === 0) continue;
    const groups = new Map<string, number>();
    for (const opt of mat) {
      const key = `${opt.mode}|${opt.contractPeriod}m`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    const dups = [...groups.entries()].filter(([_, c]) => c > 1);
    if (dups.length > 0) {
      dupCount++;
      console.log(`  ⚠ priceMatrix 중복 ${p.productCode}: ${dups.map(([k, c]) => `${k}×${c}`).join(", ")}`);
    }
  }
  console.log(`(1) priceMatrix 중복: ${dupCount}건  ${dupCount === 0 ? "✓" : "✗"}\n`);

  // 2) modelName 일치
  let modelMismatch = 0;
  for (const p of seeded) {
    if (p.modelName !== p.productCode) {
      modelMismatch++;
      console.log(`  ⚠ modelName mismatch: ${p.productCode}  modelName="${p.modelName}"`);
    }
  }
  console.log(`(2) modelName != productCode: ${modelMismatch}건  ${modelMismatch === 0 ? "✓" : "✗"}\n`);

  // 3) imageUrl 누락
  let imageMissing = 0;
  for (const p of seeded) {
    if (!p.imageUrl || p.imageUrl.trim() === "") {
      imageMissing++;
      console.log(`  ⚠ imageUrl 없음: ${p.productCode} "${p.name}"`);
    }
  }
  console.log(`(3) imageUrl 누락: ${imageMissing}건  ${imageMissing === 0 ? "✓" : "(필요시 후속작업)"}\n`);

  // 4) 색상 변형 5개 imageUrl source 노트
  const COLOR_VARIANT_CODES = ["WPUIAC606SSB", "ACL16C2ASKZG", "ACL22C2ASKZG", "ACL300VASKWH", "WPUGBC102SWW"];
  console.log(`(4) 색상 변형 5개 imageUrl 상태 (HQ 액션 필요):`);
  for (const code of COLOR_VARIANT_CODES) {
    const p = seeded.find(s => s.productCode === code);
    if (!p) continue;
    console.log(`  - ${p.productCode}  "${p.name}"`);
    console.log(`     status: ${p.status}, imageUrl: ${p.imageUrl?.slice(0, 80) ?? "(null)"}`);
  }

  // 5) sample summary
  console.log(`\n(5) 4개 sample 의 priceMatrix mode×period:`);
  const SAMPLES = ["WPUIAC606SSB", "WPUIAC606SNW", "ACL16C2ASKZG", "MATQM230RSBR"];
  for (const code of SAMPLES) {
    const p = await prisma.product.findUnique({
      where: { productCode: code },
      select: { productCode: true, name: true, priceMatrix: true, modelName: true, imageUrl: true, status: true },
    });
    if (!p) { console.log(`  - ${code}: 없음`); continue; }
    const mat = (p.priceMatrix as Array<Record<string, unknown>>) ?? [];
    const visit = mat.filter(o => o.mode === "방문형").map(o => Number(o.contractPeriod));
    const self = mat.filter(o => o.mode === "셀프형").map(o => Number(o.contractPeriod));
    console.log(`  - ${p.productCode} "${p.name}"`);
    console.log(`     status=${p.status}, modelName=${p.modelName}, imageUrl=${p.imageUrl?.slice(0, 60) ?? "(null)"}`);
    console.log(`     priceMatrix: 방문형{${visit.join(",")}} + 셀프형{${self.join(",")}} = ${mat.length}개`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
