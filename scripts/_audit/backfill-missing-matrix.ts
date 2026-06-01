/**
 * priceMatrix 가 비어있는 active Product 22개에 6월 정책 xlsx 데이터로 priceMatrix 채움.
 *
 * 동일 변환 룰 적용 (apply-policy-june-2026 와 일치):
 *   - basePrice  = col[7] 운영가 (VAT 포함 그대로)
 *   - rentalPrice = col[7] (운영가) — 룰북 동일
 *   - promoPrice = col[8] 판촉가
 *   - cardDiscountPrice = col[9]
 *   - baseCommission = col[16] 수수료 (VAT 포함 — priceMatrix 는 VAT 포함값 그대로)
 *   - contractPeriod = col[4]
 *   - ownershipPeriod = col[5]
 *   - mode = col[3] (방문형/셀프형)
 *   - visitInterval = col[6]
 *   - variantLabel = col[3] (전체 — 색상/사이즈 포함)
 *   - rivalCompensationPrice = col[10]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import xlsx from "xlsx";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const JUNE = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx";
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

function buildMatrixFromXlsx(): Map<string, MatrixOption[]> {
  const wb = xlsx.readFile(JUNE);
  const ws = wb.Sheets["판매수수료_6월"];
  const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  const map = new Map<string, MatrixOption[]>();
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i];
    const code = typeof r[2] === "string" ? r[2].trim() : "";
    if (!code) continue;
    const variantRaw = String(r[3] ?? "");
    const mode = variantRaw.includes("셀프") ? "셀프형" : variantRaw.includes("방문") ? "방문형" : "방문형";
    const basePrice = num(r[7]) ?? 0;
    const promoPrice = num(r[8]);
    const cardDiscountPrice = num(r[9]);
    const contractPeriod = Number(r[4]) || 0;
    const ownershipPeriod = Number(r[5]) || contractPeriod;
    const visitInterval = String(r[6] ?? "").trim();
    const rivalPriceRaw = num(r[10]);
    const baseCommission = num(r[16]) ?? 0;

    const halfMatch = rivalPriceRaw === null ? null : (() => {
      // 6월 정책 룰: 60m 이상 약정 시 첫 3개월 반값 적용 (rivalCompensationHalfPriceMonths)
      // 36m 등 단기는 null. 5월 패턴과 동일.
      if (contractPeriod >= 60) return 3;
      return null;
    })();

    const opt: MatrixOption = {
      mode,
      basePrice,
      rentalPrice: basePrice, // 룰북: rentalPrice = 운영가 (col[7])
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
    const existing = map.get(code) ?? [];
    existing.push(opt);
    map.set(code, existing);
  }
  return map;
}

async function main() {
  console.log(`▶ 모드: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  const matrices = buildMatrixFromXlsx();
  console.log(`6월 xlsx 에서 추출한 priceMatrix: ${matrices.size}개 코드\n`);

  // matrix 비어있는 active Product 추출
  const all = await prisma.product.findMany({
    where: { status: "active" },
    select: { productCode: true, name: true, category: true, priceMatrix: true },
  });
  const targets = all.filter(p => {
    const m = p.priceMatrix;
    return !Array.isArray(m) || m.length === 0;
  });
  console.log(`priceMatrix 비어있는 active Product: ${targets.length}개\n`);

  let success = 0, missing = 0;
  for (const p of targets) {
    const newMatrix = matrices.get(p.productCode);
    if (!newMatrix || newMatrix.length === 0) {
      console.log(`  ⚠ ${p.productCode} — xlsx 에 매칭 row 없음, skip`);
      missing++;
      continue;
    }
    console.log(`  + ${p.productCode} (${p.category}) — ${newMatrix.length}개 옵션`);
    if (APPLY) {
      await prisma.product.update({
        where: { productCode: p.productCode },
        data: { priceMatrix: newMatrix as object },
      });
    }
    success++;
  }

  console.log(`\n📊 결과: 성공 ${success}, xlsx 매칭 없음 ${missing}`);
  if (!APPLY) console.log(`\nDRY-RUN. 실제 적용: APPLY=1 npx tsx scripts/_audit/backfill-missing-matrix.ts`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
