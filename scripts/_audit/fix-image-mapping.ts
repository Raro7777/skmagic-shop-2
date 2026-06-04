/**
 * Phase 3 — 색상별 imageUrl 매핑.
 *
 * 시드 19개의 imageUrl 은 모두 source Product 의 imageUrl 을 차용한 상태.
 *   - 매트리스 15개: 사이즈만 다름 (S/Q/K), 색상 동일 → 이미지 공유 OK (변경 불필요)
 *   - WPUIAC606SSB (애쉬블루): NW 의 이미지 사용 중 → SB 색상 이미지 source 필요
 *   - ACL16C2ASKZG (다크그린, C2A 신모델): C1A OB 의 이미지 사용 중 → C2A ZG 이미지 source 필요
 *   - ACL22C2ASKZG (다크그린, C2A 신모델): C1A OB 의 이미지 사용 중 → C2A ZG 이미지 source 필요
 *   - ACL300VASKWH (신모델): ACL25C1ASKCE 이미지 사용 중 → 신모델 이미지 source 필요
 *   - WPUGBC102SWW (위글위글): SCE 의 이미지 사용 중 → 위글위글 캐릭터 이미지 source 필요
 *
 * 자동 매칭 시도:
 *   - CrawledProduct (productCode | modelName | name 키워드) 에서 색상 변형 검색
 *   - Product 테이블 (같은 productCode prefix, 다른 색상 suffix) 에서 검색
 *
 * 매칭 결과 사전 분석 (별도 _inspect-crawled-candidates.ts):
 *   - WPUIAC606SSB → SB 색상 CrawledProduct 없음 (NW/OB 만 존재)
 *   - ACL16C2ASKZG / ACL22C2ASKZG → C2A 신모델 CrawledProduct 없음 (C1A 만 존재)
 *   - ACL300VASKWH → 신모델 CrawledProduct 없음
 *   - WPUGBC102SWW → 위글위글 캐릭터 정수기 CrawledProduct 없음 (에코미니 SCE 만 존재)
 *
 * 결론: 5개 모두 자동 매핑 불가. 본사에서 실제 색상별 imageUrl 제공 필요.
 *       이 스크립트는 향후 source 가 추가되었을 때 다시 실행 가능하도록 매칭 로직만 유지.
 *
 * 실행:
 *   DRY-RUN:  npx tsx scripts/_audit/fix-image-mapping.ts
 *   APPLY:    APPLY=1 npx tsx scripts/_audit/fix-image-mapping.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.env.APPLY === "1" || process.argv.includes("--apply");

// 색상별 매핑 후보 대상 (매트리스 사이즈-only 는 제외 — 이미지 공유 OK)
const COLOR_VARIANT_TARGETS = [
  { code: "WPUIAC606SSB", color: "SB", colorLabel: "애쉬블루", categoryGuard: "water",
    note: "MEGA ICE mini — SB 색상, CrawledProduct 에 SB source 없음" },
  { code: "ACL16C2ASKZG", color: "ZG", colorLabel: "다크그린", categoryGuard: "air",
    note: "16평 디아트 — C2A 신형 + ZG, CrawledProduct 에 C2A 또는 ZG source 없음" },
  { code: "ACL22C2ASKZG", color: "ZG", colorLabel: "다크그린", categoryGuard: "air",
    note: "22평 디아트 — C2A 신형 + ZG, CrawledProduct 에 C2A 또는 ZG source 없음" },
  { code: "ACL300VASKWH", color: "WH", colorLabel: "화이트", categoryGuard: "air",
    note: "슈퍼 ACL300 신모델, CrawledProduct 에 source 없음" },
  { code: "WPUGBC102SWW", color: "WW", colorLabel: "위글위글", categoryGuard: "water",
    note: "에코미니 위글위글 캐릭터판, CrawledProduct 에 WW 캐릭터 source 없음" },
];

type Match = {
  code: string;
  before: string | null;
  after: string | null;
  source: string;
  rationale: string;
};

async function findImageCandidate(code: string, colorKeyword: string, categoryGuard: string): Promise<Match | null> {
  // 1) CrawledProduct: 같은 productCode 정확 매칭 (시드 후 본사가 신규 모델 크롤을 추가했을 가능성).
  //    카테고리 강제 일치.
  const exact = await prisma.crawledProduct.findFirst({
    where: { productCode: code, imageUrl: { not: null }, category: categoryGuard },
    orderBy: { crawledAt: "desc" },
    select: { imageUrl: true, name: true, category: true },
  });
  if (exact?.imageUrl) {
    return { code, before: null, after: exact.imageUrl, source: "CrawledProduct.productCode", rationale: `정확 매칭: "${exact.name}"` };
  }

  // 2) CrawledProduct: 같은 productCode 패밀리 prefix (예: WPUIAC606S* 안에서 새 색상이 들어왔다면).
  //    code 의 앞 9글자 (예: WPUIAC606)를 사용. category 강제.
  const familyPrefix = code.slice(0, 9);
  const family = await prisma.crawledProduct.findFirst({
    where: {
      AND: [
        { productCode: { startsWith: familyPrefix } },
        { productCode: { not: code } }, // 자기 자신 외
      ],
      imageUrl: { not: null },
      category: categoryGuard,
      name: { contains: colorKeyword },
    },
    orderBy: { crawledAt: "desc" },
    select: { imageUrl: true, name: true, productCode: true, category: true },
  });
  if (family?.imageUrl) {
    return { code, before: null, after: family.imageUrl, source: `CrawledProduct.${familyPrefix}*+name~"${colorKeyword}"+cat=${categoryGuard}`, rationale: `패밀리매칭: "${family.name}" (productCode=${family.productCode ?? "-"})` };
  }

  // 3) 그 외 (다른 모델의 같은 색상 키워드) — 모델이 다르면 적합하지 않음. skip.
  return null;
}

async function main() {
  console.log(`\n=== Phase 3: fix-image-mapping ===`);
  console.log(`mode: ${APPLY ? "🚀 APPLY" : "🧪 DRY-RUN"}\n`);

  // 매트리스 사이즈-only 시드 14개는 이미지 공유 OK 로 표시.
  console.log(`=== 매트리스 사이즈-only 시드 (이미지 공유 OK) ===`);
  const matSeeded = await prisma.product.findMany({
    where: {
      description: { contains: "[seeded from" },
      productCode: { startsWith: "MAT" },
    },
    select: { productCode: true, name: true, imageUrl: true },
    orderBy: { productCode: "asc" },
  });
  for (const p of matSeeded) {
    console.log(`  ✓ ${p.productCode}  "${p.name}"  (사이즈만 다름 — 이미지 변경 불필요)`);
  }
  console.log(`  → ${matSeeded.length}개 변경 없음\n`);

  // 색상 변형 5개 — 자동 매칭 시도
  console.log(`=== 색상 변형 5개 — 자동 매칭 시도 ===`);
  const updates: Match[] = [];
  const noSource: Array<{ code: string; colorLabel: string; current: string | null; note: string }> = [];
  for (const t of COLOR_VARIANT_TARGETS) {
    const current = await prisma.product.findUnique({
      where: { productCode: t.code },
      select: { imageUrl: true, name: true },
    });
    const match = await findImageCandidate(t.code, t.colorLabel, t.categoryGuard);
    if (match && match.after && match.after !== current?.imageUrl) {
      // 후보가 현재 imageUrl 과 다른 경우만 update 후보로 분류
      match.before = current?.imageUrl ?? null;
      updates.push(match);
      console.log(`  ✓ ${t.code}  "${current?.name}"`);
      console.log(`     before: ${match.before ?? "(null)"}`);
      console.log(`     after:  ${match.after}  (${match.source})`);
      console.log(`     rationale: ${match.rationale}`);
    } else if (match && match.after === current?.imageUrl) {
      // CrawledProduct 매칭 결과가 현재와 동일 — 변경 불필요
      console.log(`  - ${t.code}  CrawledProduct 매칭 결과가 현재 imageUrl 과 동일 — 변경 불필요`);
      noSource.push({ code: t.code, colorLabel: t.colorLabel, current: current?.imageUrl ?? null, note: t.note });
    } else {
      console.log(`  ⚠ ${t.code}  "${current?.name}"  — 매칭 source 없음`);
      console.log(`     current: ${current?.imageUrl ?? "(null)"}`);
      console.log(`     note: ${t.note}`);
      noSource.push({ code: t.code, colorLabel: t.colorLabel, current: current?.imageUrl ?? null, note: t.note });
    }
  }

  console.log(`\n📊 결과:`);
  console.log(`  - 자동 매칭 성공 (update 가능): ${updates.length}개`);
  console.log(`  - 매칭 source 없음 (변경 불가, 본사 액션 필요): ${noSource.length}개`);

  if (noSource.length > 0) {
    console.log(`\n⚠ 본사 액션 필요 — 색상별 imageUrl 수동 교체:`);
    for (const n of noSource) {
      console.log(`  - ${n.code} (${n.colorLabel}) — 현재 imageUrl 은 source 모델 이미지`);
      console.log(`     ${n.note}`);
    }
  }

  if (!APPLY) {
    console.log(`\n🧪 DRY-RUN — 실제 적용: APPLY=1 npx tsx scripts/_audit/fix-image-mapping.ts\n`);
    return;
  }

  console.log(`\n🚀 APPLY — imageUrl UPDATE\n`);
  let n = 0;
  for (const u of updates) {
    if (!u.after) continue;
    await prisma.product.update({
      where: { productCode: u.code },
      data: { imageUrl: u.after },
    });
    n++;
    console.log(`  + ${u.code}  imageUrl ← ${u.after}`);
  }
  console.log(`\n✓ ${n} Product imageUrl 갱신 완료.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
