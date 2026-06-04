/**
 * Phase 1 — priceMatrix mode inheritance 정정.
 *
 * 원인:
 *   backfill-missing-matrix.ts 에서 xlsx col[3] (variantLabel) 의 빈 값을
 *   기본 "방문형" 으로 처리해, 같은 productCode 의 셀프형 row 들이 잘못 방문형으로 들어감.
 *
 * 수정:
 *   xlsx 의 같은 productCode 안에서 col[3] 이 빈 값이면 직전 row 의 mode 를 상속.
 *   xlsx 의 productCode 가 바뀌면 mode 컨텍스트 리셋.
 *   재계산한 matrix 와 현재 DB priceMatrix 비교 → 변경된 Product 만 update.
 *
 * 실행:
 *   DRY-RUN:  npx tsx scripts/_audit/fix-matrix-mode-inheritance.ts
 *   APPLY:    APPLY=1 npx tsx scripts/_audit/fix-matrix-mode-inheritance.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import xlsx from "xlsx";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const JUNE = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx";
const SHEET = "판매수수료_6월";
const APPLY = process.env.APPLY === "1" || process.argv.includes("--apply");

type MatrixOption = {
  mode: string;
  basePrice: number;
  rentalPrice: number;
  promoPrice: number | null;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  ownershipPeriod: number;
  visitInterval: string;
  variantLabel: string;
  baseCommission: number;
  rivalCompensationPrice: number | null;
  rivalCompensationHalfPriceMonths: number | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 같은 productCode 의 row 들에서 col[3] 이 비어있으면 직전 row 의 mode 를 상속.
 * 빈 값이 아니라면 키워드("방문"/"셀프") 로 판정. 키워드도 없고 빈 값이면 직전 mode 상속.
 * 가장 첫 row 의 col[3] 에 키워드가 전혀 없으면 기본값 "방문형" (안전 fallback).
 */
function buildMatrixFromXlsx(): Map<string, MatrixOption[]> {
  const wb = xlsx.readFile(JUNE);
  const ws = wb.Sheets[SHEET];
  const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  const map = new Map<string, MatrixOption[]>();

  let currentCode = "";
  let lastMode = "방문형"; // per-productCode inherited mode

  for (let i = 12; i < rows.length; i++) {
    const r = rows[i];
    const explicitCode = typeof r[2] === "string" ? r[2].trim() : "";
    if (explicitCode) {
      // 새 productCode 시작 — mode context 리셋
      if (explicitCode !== currentCode) {
        currentCode = explicitCode;
        lastMode = "방문형"; // reset; 곧 col[3] 키워드로 덮어쓰여짐
      }
    }
    if (!currentCode) continue;

    const variantRaw = String(r[3] ?? "");
    const variantTrim = variantRaw.trim();
    // mode 결정:
    //   - "셀프" 포함 → 셀프형 (lastMode 갱신)
    //   - "방문" 포함 → 방문형 (lastMode 갱신)
    //   - 비어있음 → lastMode 상속
    //   - 그 외 (예: 매트리스 "Q"/"K") → 방문형 (lastMode 갱신, 첫 등장 row 는 방문형이 룰)
    let mode: string;
    if (variantTrim === "") {
      mode = lastMode;
    } else if (variantRaw.includes("셀프")) {
      mode = "셀프형";
      lastMode = mode;
    } else if (variantRaw.includes("방문")) {
      mode = "방문형";
      lastMode = mode;
    } else {
      // 매트리스의 "Q"/"K" 첫 row — 방문형 라벨 없지만 기본 방문형
      mode = "방문형";
      lastMode = mode;
    }

    const basePrice = num(r[7]) ?? 0;
    const promoPrice = num(r[8]);
    const cardDiscountPrice = num(r[9]);
    const contractPeriod = Number(r[4]) || 0;
    const ownershipPeriod = Number(r[5]) || contractPeriod;
    const visitInterval = String(r[6] ?? "").trim();
    const rivalPriceRaw = num(r[10]);
    const baseCommission = num(r[16]) ?? 0;

    if (contractPeriod === 0) continue; // 헤더/구분 row skip

    const halfMatch = rivalPriceRaw === null ? null : (contractPeriod >= 60 ? 3 : null);

    const opt: MatrixOption = {
      mode,
      basePrice,
      rentalPrice: basePrice,
      promoPrice,
      cardDiscountPrice,
      contractPeriod,
      ownershipPeriod,
      visitInterval,
      variantLabel: variantRaw,
      baseCommission,
      rivalCompensationPrice: rivalPriceRaw,
      rivalCompensationHalfPriceMonths: halfMatch,
    };

    const existing = map.get(currentCode) ?? [];
    existing.push(opt);
    map.set(currentCode, existing);
  }
  return map;
}

function countDuplicates(mat: Array<Record<string, unknown>>): Map<string, number> {
  const groups = new Map<string, number>();
  for (const opt of mat) {
    const key = `${opt.mode}|${opt.contractPeriod}m`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return groups;
}

function matrixSummary(mat: Array<Record<string, unknown>>): string {
  const groups = countDuplicates(mat);
  const parts: string[] = [];
  const visitPeriods: number[] = [];
  const selfPeriods: number[] = [];
  for (const opt of mat) {
    if (opt.mode === "방문형") visitPeriods.push(Number(opt.contractPeriod));
    else if (opt.mode === "셀프형") selfPeriods.push(Number(opt.contractPeriod));
  }
  if (visitPeriods.length) parts.push(`방문형{${visitPeriods.join(",")}}`);
  if (selfPeriods.length) parts.push(`셀프형{${selfPeriods.join(",")}}`);
  const dups = [...groups.entries()].filter(([_, n]) => n > 1);
  return `${parts.join(" + ")}${dups.length > 0 ? ` ⚠ 중복 ${dups.length}건` : ""}`;
}

async function main() {
  console.log(`\n=== Phase 1: fix-matrix-mode-inheritance ===`);
  console.log(`mode: ${APPLY ? "🚀 APPLY" : "🧪 DRY-RUN"}\n`);

  // 1) xlsx 재해석 — mode 상속 룰 적용
  const correctMatrices = buildMatrixFromXlsx();
  console.log(`xlsx 재해석: ${correctMatrices.size}개 productCode\n`);

  // 2) 시드된 19개 + 진단에서 동일 버그가 확인된 non-seeded Product 2개 (WPUIAC606SNW/SOB).
  //    그 외 Product 는 backfill 외 다른 경로로 priceMatrix 가 들어왔거나 의도된 차이가 있을 수 있으므로
  //    범위를 좁힘.
  const NON_SEEDED_TARGETS = ["WPUIAC606SNW", "WPUIAC606SOB"];
  const seeded = await prisma.product.findMany({
    where: {
      OR: [
        { description: { contains: "[seeded from" } },
        { productCode: { in: NON_SEEDED_TARGETS } },
      ],
    },
    select: { productCode: true, name: true, priceMatrix: true },
  });
  console.log(`대상: 시드 Product + 동일 버그 영향 ${seeded.length}개 (캐노니컬 비교로 실제 변경된 것만 update)`);

  const updates: Array<{
    productCode: string;
    name: string;
    before: MatrixOption[];
    after: MatrixOption[];
    beforeSummary: string;
    afterSummary: string;
  }> = [];

  // 캐노니컬 비교 — 키 순서 무관, 길이/페어링 기준 동등 검사.
  const canonical = (mat: MatrixOption[]) => JSON.stringify(
    [...mat].map(o => ({
      mode: o.mode,
      contractPeriod: Number(o.contractPeriod),
      ownershipPeriod: Number(o.ownershipPeriod),
      basePrice: Number(o.basePrice),
      promoPrice: o.promoPrice ?? null,
      cardDiscountPrice: o.cardDiscountPrice ?? null,
      visitInterval: o.visitInterval ?? "",
      variantLabel: o.variantLabel ?? "",
      baseCommission: Number(o.baseCommission),
      rivalCompensationPrice: o.rivalCompensationPrice ?? null,
      rivalCompensationHalfPriceMonths: o.rivalCompensationHalfPriceMonths ?? null,
    }))
    .sort((a, b) => String(a.mode) + String(a.contractPeriod).padStart(4, "0") < String(b.mode) + String(b.contractPeriod).padStart(4, "0") ? -1 : 1),
  );

  for (const p of seeded) {
    const before = (p.priceMatrix as MatrixOption[]) ?? [];
    const after = correctMatrices.get(p.productCode);
    if (!after || after.length === 0) {
      console.log(`  ⚠ ${p.productCode} — xlsx 에 매칭 row 없음, skip`);
      continue;
    }
    // 변경 감지: 캐노니컬 비교
    const changed = canonical(before) !== canonical(after);
    if (!changed) continue;
    updates.push({
      productCode: p.productCode,
      name: p.name,
      before,
      after,
      beforeSummary: matrixSummary(before as Array<Record<string, unknown>>),
      afterSummary: matrixSummary(after as Array<Record<string, unknown>>),
    });
  }

  console.log(`\n📊 변경 대상 Product: ${updates.length}개\n`);

  // 3) 변경 전후 매트릭스 sample (전체 dump — 대상이 적음)
  console.log(`=== 변경 전후 mode×period 매트릭스 ===\n`);
  for (const u of updates) {
    console.log(`▶ ${u.productCode}  "${u.name}"`);
    console.log(`   BEFORE: ${u.beforeSummary} (${u.before.length} rows)`);
    console.log(`   AFTER:  ${u.afterSummary} (${u.after.length} rows)`);
  }

  // 4) sample 5개 dump — row 단위
  console.log(`\n=== sample 5개 row 단위 dump ===\n`);
  for (const u of updates.slice(0, 5)) {
    console.log(`▶▶ ${u.productCode} "${u.name}"`);
    console.log(`   BEFORE rows:`);
    for (const o of u.before) {
      console.log(`     [${o.mode}/${o.contractPeriod}m] basePrice=${o.basePrice} promo=${o.promoPrice ?? "-"} variant="${String(o.variantLabel ?? "").replace(/\n/g, "\\n").slice(0, 30)}"`);
    }
    console.log(`   AFTER rows:`);
    for (const o of u.after) {
      console.log(`     [${o.mode}/${o.contractPeriod}m] basePrice=${o.basePrice} promo=${o.promoPrice ?? "-"} variant="${String(o.variantLabel ?? "").replace(/\n/g, "\\n").slice(0, 30)}"`);
    }
    console.log("");
  }

  if (!APPLY) {
    console.log(`🧪 DRY-RUN — DB 변경 없음. 실제 적용:`);
    console.log(`   APPLY=1 npx tsx scripts/_audit/fix-matrix-mode-inheritance.ts\n`);
    return;
  }

  console.log(`\n🚀 APPLY — Product priceMatrix UPDATE (${updates.length} rows)\n`);
  let n = 0;
  for (const u of updates) {
    await prisma.product.update({
      where: { productCode: u.productCode },
      data: { priceMatrix: u.after as object },
    });
    n++;
    console.log(`  + ${u.productCode}  [${u.beforeSummary}] → [${u.afterSummary}]`);
  }
  console.log(`\n✓ ${n} Product priceMatrix 갱신 완료.`);

  // 5) 사후 검증 — 시드 + 동일 버그 영향 대상의 중복 0건 확인
  console.log(`\n=== 사후 검증 ===`);
  const verify = await prisma.product.findMany({
    where: {
      OR: [
        { description: { contains: "[seeded from" } },
        { productCode: { in: NON_SEEDED_TARGETS } },
      ],
    },
    select: { productCode: true, priceMatrix: true },
  });
  let dupRemaining = 0;
  for (const p of verify) {
    const mat = (p.priceMatrix as Array<Record<string, unknown>> | null) ?? [];
    if (!Array.isArray(mat) || mat.length === 0) continue;
    const groups = countDuplicates(mat);
    const dups = [...groups.entries()].filter(([_, c]) => c > 1);
    if (dups.length > 0) {
      dupRemaining++;
      console.log(`  ⚠ ${p.productCode} — 잔존 중복: ${dups.map(([k, c]) => `${k}×${c}`).join(", ")}`);
    }
  }
  if (dupRemaining === 0) console.log(`  ✓ 시드 + 동일 버그 영향 ${verify.length}개 priceMatrix 중복 0건`);
  else console.log(`  ✗ 잔존 중복 Product: ${dupRemaining}개`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
