/**
 * 6월 정책 26개 신규 productCode 의 Product row 시드.
 *
 * Source 매핑 전략:
 *   1. 매트리스 23개 — productCode 의 4번째 글자(사이즈 S/Q/K) 만 다른 source Product
 *      를 찾아서 imageUrl/imageUrls/name/category/specs/keyFeatures/description 차용.
 *      6월 xlsx 의 color 컬럼 (예: SS/Q/K) 를 name 끝에 표기.
 *   2. 공기청정기:
 *      - ACL16C2ASKZG ← ACL16C1ASKOB (16평 디아트, 신형 C2A, 색상 ZG=다크그린)
 *      - ACL22C2ASKZG ← ACL22C1ASKOB (22평 디아트, 신형 C2A, 색상 ZG=다크그린)
 *      - ACL300VASKWH ← ACL25C1ASKCE (visual placeholder, 신모델 슈퍼 ACL300)
 *   3. 정수기:
 *      - WPUIAC606SSB ← WPUIAC606SNW (MEGA ICE mini, 색상 SB=애쉬블루)
 *      - WPUGBC102SWW ← WPUGBC102SCE (에코미니 platform 차용, 6월 신모델 "위글위글")
 *
 * 차용 시 다음을 reviewNote-style 로 description 에 prepend:
 *   "[seeded from <source-code>: prefix-match] ..."
 *
 * 가격은 0/NULL — 후속 `apply-policy-june-2026.ts --apply` 가 갱신.
 *
 * 실행:
 *   DRY-RUN (기본): npx tsx scripts/_audit/seed-26-products.ts
 *   실제 적용:      APPLY=1 npx tsx scripts/_audit/seed-26-products.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import xlsx from "xlsx";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.env.APPLY === "1" || process.argv.includes("--apply");
const JUNE_XLSX =
  process.env.JUNE_XLSX_PATH ||
  "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx";
const JUNE_SHEET = "판매수수료_6월";

// ─────────────────────────────────────────────────────────────────────────────
// 26개 코드별 source/매핑 정의
// ─────────────────────────────────────────────────────────────────────────────

type Mapping = {
  targetCode: string;
  /** source Product.productCode — Product 또는 CrawledProduct 에서 찾을 때 사용. */
  sourceCode: string | null;
  /** xlsx 6월 row 의 명시적 name (col[1]) — source name override 용. null 이면 source name 사용. */
  explicitName?: string;
  /** 6월 xlsx 의 color (col[3]) 에서 추출되는 색상 label (한글). */
  colorLabel: string;
  /** 사이즈 (매트리스만). */
  size?: "SS" | "Q" | "K";
  /** category fallback (source 미존재 시). */
  fallbackCategory: string;
  /** 매핑 노트. */
  note: string;
};

const MAPPINGS: Mapping[] = [
  // ─── 매트리스 (모두 MAT 사이즈 swap) ──────────────────────────────────────
  // MAT*D011RFBR family (D011 series, S/Q/K) — 5월/6월 xlsx 만 있음, Crawl/Product 둘 다 source 없음
  { targetCode: "MATSD011RFBR", sourceCode: null, explicitName: "MAT*D011", colorLabel: "SS", size: "SS", fallbackCategory: "mattress",
    note: "CrawledProduct/Product 모두 MAT*D011 series 미수록 — xlsx 메타만 사용, 이미지/스펙 placeholder 필요" },
  { targetCode: "MATQD011RFBR", sourceCode: null, explicitName: "MAT*D011", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "CrawledProduct/Product 모두 MAT*D011 series 미수록 — xlsx 메타만 사용" },
  { targetCode: "MATKD011RFBR", sourceCode: null, explicitName: "MAT*D011", colorLabel: "K", size: "K", fallbackCategory: "mattress",
    note: "CrawledProduct/Product 모두 MAT*D011 series 미수록 — xlsx 메타만 사용" },

  // MAT*H511RFBR family — 동일
  { targetCode: "MATSH511RFBR", sourceCode: null, explicitName: "MAT*H511", colorLabel: "SS", size: "SS", fallbackCategory: "mattress",
    note: "CrawledProduct/Product 모두 MAT*H511 series 미수록" },
  { targetCode: "MATQH511RFBR", sourceCode: null, explicitName: "MAT*H511", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "CrawledProduct/Product 모두 MAT*H511 series 미수록" },
  { targetCode: "MATKH511RFBR", sourceCode: null, explicitName: "MAT*H511", colorLabel: "K", size: "K", fallbackCategory: "mattress",
    note: "CrawledProduct/Product 모두 MAT*H511 series 미수록" },

  // 워커힐 클라우드 (M430RLWH) — source: MATSM430RLWH (S)
  { targetCode: "MATQM430RLWH", sourceCode: "MATSM430RLWH", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "워커힐 클라우드 — S→Q size swap" },
  { targetCode: "MATKM430RLWH", sourceCode: "MATSM430RLWH", colorLabel: "K", size: "K", fallbackCategory: "mattress",
    note: "워커힐 클라우드 — S→K size swap" },

  // 워커힐 스탠다드 (M730RZOM) — source: MATSM730RZOM
  { targetCode: "MATQM730RZOM", sourceCode: "MATSM730RZOM", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "워커힐 스탠다드 — S→Q size swap" },

  // MAT-*H651R (H651RZWD) — source 없음
  { targetCode: "MATQH651RZWD", sourceCode: null, explicitName: "MAT-*H651R", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "MAT-*H651R series 신규 — 매핑할 source 없음" },

  // 워커힐 스위트 (M230RSBR) — source: MATSM230RSBR
  { targetCode: "MATQM230RSBR", sourceCode: "MATSM230RSBR", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "워커힐 스위트 — S→Q size swap" },
  { targetCode: "MATKM230RSBR", sourceCode: "MATSM230RSBR", colorLabel: "K", size: "K", fallbackCategory: "mattress",
    note: "워커힐 스위트 — S→K size swap" },

  // 수납형 프레임 (H510RKWH) — source: MATSH510RKWH
  { targetCode: "MATQH510RKWH", sourceCode: "MATSH510RKWH", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "수납형 프레임 — S→Q size swap" },

  // 패브릭 파운데이션 (F520RKIV) — source: MATSF520RKIV
  { targetCode: "MATQF520RKIV", sourceCode: "MATSF520RKIV", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "패브릭 파운데이션 — S→Q size swap" },
  { targetCode: "MATKF520RKIV", sourceCode: "MATSF520RKIV", colorLabel: "K", size: "K", fallbackCategory: "mattress",
    note: "패브릭 파운데이션 — S→K size swap" },

  // PVC 레더 파운데이션 (F530RKBE) — source: MATSF530RKBE
  { targetCode: "MATQF530RKBE", sourceCode: "MATSF530RKBE", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "PVC 레더 파운데이션 — S→Q size swap" },
  { targetCode: "MATKF530RKBE", sourceCode: "MATSF530RKBE", colorLabel: "K", size: "K", fallbackCategory: "mattress",
    note: "PVC 레더 파운데이션 — S→K size swap" },

  // 패브릭 헤드보드 (H520RKIV) — source: MATSH520RKIV
  { targetCode: "MATQH520RKIV", sourceCode: "MATSH520RKIV", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "패브릭 헤드보드 — S→Q size swap" },
  { targetCode: "MATKH520RKIV", sourceCode: "MATSH520RKIV", colorLabel: "K", size: "K", fallbackCategory: "mattress",
    note: "패브릭 헤드보드 — S→K size swap" },

  // PVC 레더 헤드보드 (H530RKBE) — source: MATSH530RKBE
  { targetCode: "MATQH530RKBE", sourceCode: "MATSH530RKBE", colorLabel: "Q", size: "Q", fallbackCategory: "mattress",
    note: "PVC 레더 헤드보드 — S→Q size swap" },
  { targetCode: "MATKH530RKBE", sourceCode: "MATSH530RKBE", colorLabel: "K", size: "K", fallbackCategory: "mattress",
    note: "PVC 레더 헤드보드 — S→K size swap" },

  // ─── 공기청정기 ─────────────────────────────────────────────────────────
  { targetCode: "ACL16C2ASKZG", sourceCode: "ACL16C1ASKOB", colorLabel: "다크그린", fallbackCategory: "air",
    note: "16평 올클린 디아트 — C1A→C2A 신형, 색상 OB→ZG" },
  { targetCode: "ACL22C2ASKZG", sourceCode: "ACL22C1ASKOB", colorLabel: "다크그린", fallbackCategory: "air",
    note: "22평 올클린 디아트 — C1A→C2A 신형, 색상 OB→ZG" },
  { targetCode: "ACL300VASKWH", sourceCode: "ACL25C1ASKCE", colorLabel: "화이트", fallbackCategory: "air",
    note: "슈퍼 ACL300 — 신모델, ACL25 (25평 올클린) 이미지/스펙 placeholder 차용 (가장 가까운 라인업)" },

  // ─── 정수기 ─────────────────────────────────────────────────────────────
  { targetCode: "WPUGBC102SWW", sourceCode: "WPUGBC102SCE", colorLabel: "위글위글", fallbackCategory: "water",
    note: "위글위글 — 에코미니(SCE) platform 차용, 색상 화이트→위글위글 캐릭터" },
  { targetCode: "WPUIAC606SSB", sourceCode: "WPUIAC606SNW", colorLabel: "애쉬블루", fallbackCategory: "water",
    note: "MEGA ICE mini — 동일 모델, 색상 SNW(내츄럴화이트)→SSB(애쉬블루)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// xlsx 메타 (color / name) 추출
// ─────────────────────────────────────────────────────────────────────────────

function loadXlsxMeta(file: string, sheetName: string, codes: Set<string>): Map<string, { name: string; color: string; category: string }> {
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  const out = new Map<string, { name: string; color: string; category: string }>();
  let currentCategory = "";
  let currentName = "";
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i];
    const cat = String(r[0] ?? "").trim();
    const name = String(r[1] ?? "").trim();
    const code = typeof r[2] === "string" ? r[2].trim() : "";
    const color = String(r[3] ?? "").trim();
    if (cat) currentCategory = cat;
    if (name) currentName = name;
    if (!codes.has(code) || out.has(code)) continue;
    out.set(code, {
      name: name || currentName,
      color,
      category: cat || currentCategory,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 시드 row 생성
// ─────────────────────────────────────────────────────────────────────────────

type SeedRow = {
  productCode: string;
  category: string;
  name: string;
  modelName: string;
  imageUrl: string | null;
  imageUrls: string[];
  rentalPrice: number;
  baseRentalPrice: number | null;
  promoRentalPrice: number | null;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  managementType: string;
  description: string | null;
  keyFeatures: unknown;
  specs: unknown;
  warrantyMonths: number;
  isFeatured: boolean;
  status: string;
};

function deriveCategory(targetCode: string, fallback: string): string {
  if (targetCode.startsWith("MAT")) return "mattress";
  if (targetCode.startsWith("ACL")) return "air";
  if (targetCode.startsWith("WPU")) return "water";
  return fallback;
}

function deriveManagementType(category: string): string {
  // 안전한 기본값. 실제 운영은 apply-policy 가 priceMatrix 로 덮어씀.
  return "방문관리";
}

async function main() {
  console.log(`\n=== seed-26-products.ts ===`);
  console.log(`mode: ${APPLY ? "🚀 APPLY (실 INSERT)" : "🧪 DRY-RUN"}`);

  // xlsx 에서 color/name 메타 풍부히 추출
  const codeSet = new Set(MAPPINGS.map(m => m.targetCode));
  const xlsxMeta = loadXlsxMeta(JUNE_XLSX, JUNE_SHEET, codeSet);
  console.log(`xlsx 메타 로드: ${xlsxMeta.size}/${codeSet.size}`);

  // DB 존재 확인 — 이미 있는 코드는 skip
  const existingTargets = await prisma.product.findMany({
    where: { productCode: { in: [...codeSet] } },
    select: { productCode: true },
  });
  const existingSet = new Set(existingTargets.map(p => p.productCode));
  if (existingSet.size > 0) {
    console.log(`⚠ 이미 Product 에 존재하는 코드 ${existingSet.size}개: ${[...existingSet].join(", ")}`);
  }

  // source 후보 fetch
  const sourceCodes = [...new Set(MAPPINGS.map(m => m.sourceCode).filter((s): s is string => !!s))];
  const sourceProducts = await prisma.product.findMany({
    where: { productCode: { in: sourceCodes } },
    select: {
      productCode: true, name: true, modelName: true, category: true, imageUrl: true,
      imageUrls: true, description: true, keyFeatures: true, specs: true,
      managementType: true, warrantyMonths: true, contractPeriod: true,
    },
  });
  const sourceMap = new Map(sourceProducts.map(s => [s.productCode, s]));

  // 매핑 정확도 sanity
  for (const m of MAPPINGS) {
    if (m.sourceCode && !sourceMap.has(m.sourceCode)) {
      console.warn(`  ⚠ source ${m.sourceCode} for ${m.targetCode} not in Product table — fallback to placeholder`);
    }
  }

  // 시드 row 생성
  const seedRows: Array<{ row: SeedRow; mapping: Mapping; sourceProduct: typeof sourceProducts[0] | null }> = [];

  for (const m of MAPPINGS) {
    if (existingSet.has(m.targetCode)) continue;
    const meta = xlsxMeta.get(m.targetCode);
    const src = m.sourceCode ? sourceMap.get(m.sourceCode) ?? null : null;

    const category = src?.category ?? deriveCategory(m.targetCode, m.fallbackCategory);
    // name: source name 우선, 없으면 xlsx 의 explicitName/메타
    const baseName = src?.name ?? m.explicitName ?? meta?.name ?? m.targetCode;
    // 사이즈/색상 suffix
    const sizeOrColor = m.size ? ` (${m.size})` : (m.colorLabel ? ` (${m.colorLabel})` : "");
    const finalName = `${baseName}${sizeOrColor}`.trim();

    const modelName = src?.modelName ?? m.targetCode;
    const imageUrl = src?.imageUrl ?? null;
    const imageUrls = src?.imageUrls ?? [];
    const description = (() => {
      const prefix = m.sourceCode
        ? `[seeded from ${m.sourceCode}: prefix-match — ${m.note}]`
        : `[seed placeholder — no source available: ${m.note}]`;
      const body = src?.description ? "\n\n" + src.description : "";
      return prefix + body;
    })();
    const keyFeatures = src?.keyFeatures ?? null;
    const specs = src?.specs ?? null;
    const managementType = src?.managementType ?? deriveManagementType(category);
    const contractPeriod = src?.contractPeriod ?? 60;
    const warrantyMonths = src?.warrantyMonths ?? 60;

    seedRows.push({
      mapping: m,
      sourceProduct: src,
      row: {
        productCode: m.targetCode,
        category,
        name: finalName,
        modelName,
        imageUrl,
        imageUrls,
        rentalPrice: 0,            // apply-policy-june 가 갱신
        baseRentalPrice: null,
        promoRentalPrice: null,
        cardDiscountPrice: null,
        contractPeriod,
        managementType,
        description,
        keyFeatures,
        specs,
        warrantyMonths,
        isFeatured: false,
        // 자동 매핑 가능한 19개는 active (메인 노출 + 6월 정책으로 가격 채워짐),
        // source 없는 placeholder 7개는 draft 로 시드 (메인 노출 X, admin 만 보임 — 본사가 이미지/스펙 보완 후 active 전환)
        status: src === null ? "draft" : "active",
      },
    });
  }

  // 분류
  const fullyAutoMapped = seedRows.filter(s => s.sourceProduct !== null);
  const placeholderOnly = seedRows.filter(s => s.sourceProduct === null);

  console.log(`\n📊 시드 계획:`);
  console.log(`   - 전체: ${seedRows.length}개 (이미 존재 skip ${existingSet.size}개 제외)`);
  console.log(`   - 자동 매핑 (source Product 존재): ${fullyAutoMapped.length}개`);
  console.log(`   - placeholder (source 미존재): ${placeholderOnly.length}개`);
  console.log(`   - 시드 불가: 0개 (모든 코드는 최소 xlsx 메타로 시드됨)`);

  console.log(`\n=== sample dump (자동 매핑) ===`);
  for (const { row, mapping, sourceProduct } of fullyAutoMapped) {
    console.log(`✅ ${row.productCode}  ← source: ${mapping.sourceCode}`);
    console.log(`   name: "${row.name}"`);
    console.log(`   cat=${row.category}  modelName=${row.modelName}  img=${row.imageUrl ? "✓" : "✗"}  imageUrls=${row.imageUrls.length}`);
    console.log(`   note: ${mapping.note}`);
  }

  console.log(`\n=== sample dump (placeholder — source 미존재) ===`);
  for (const { row, mapping } of placeholderOnly) {
    console.log(`⚠ ${row.productCode}  (source 없음)`);
    console.log(`   name: "${row.name}"`);
    console.log(`   cat=${row.category}  modelName=${row.modelName}  img=${row.imageUrl ? "✓" : "✗"}`);
    console.log(`   note: ${mapping.note}`);
  }

  // sanity check
  console.log(`\n=== sanity check ===`);
  const sanityFails: string[] = [];
  for (const { row } of seedRows) {
    if (!row.name || row.name === row.productCode) sanityFails.push(`${row.productCode}: name 부족 ("${row.name}")`);
    if (!row.category || !["water", "air", "mattress", "bidet", "etc"].includes(row.category)) {
      sanityFails.push(`${row.productCode}: category 의심 ("${row.category}")`);
    }
  }
  if (sanityFails.length === 0) console.log(`   ✓ name/category 모두 합리적`);
  else {
    console.log(`   ⚠ sanity 의심 ${sanityFails.length}건:`);
    sanityFails.forEach(s => console.log(`     - ${s}`));
  }

  // APPLY
  if (!APPLY) {
    console.log(`\n🧪 DRY-RUN — DB 변경 없음. 실제 INSERT 하려면:`);
    console.log(`   APPLY=1 npx tsx scripts/_audit/seed-26-products.ts`);
    return;
  }

  console.log(`\n🚀 APPLY — Product INSERT 시작 (${seedRows.length} rows)`);
  let inserted = 0;
  for (const { row } of seedRows) {
    await prisma.product.create({
      data: {
        productCode: row.productCode,
        category: row.category,
        name: row.name,
        modelName: row.modelName,
        imageUrl: row.imageUrl,
        imageUrls: row.imageUrls,
        rentalPrice: row.rentalPrice,
        baseRentalPrice: row.baseRentalPrice,
        promoRentalPrice: row.promoRentalPrice,
        cardDiscountPrice: row.cardDiscountPrice,
        contractPeriod: row.contractPeriod,
        managementType: row.managementType,
        description: row.description,
        keyFeatures: row.keyFeatures as never,
        specs: row.specs as never,
        warrantyMonths: row.warrantyMonths,
        isFeatured: row.isFeatured,
        status: row.status,
      },
    });
    inserted++;
    console.log(`  + ${row.productCode}`);
  }
  console.log(`\n✓ INSERT 완료: ${inserted} rows. 다음 단계: apply-policy-june-2026.ts --apply 로 가격 채우기.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
