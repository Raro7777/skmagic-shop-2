/**
 * SK매직 정책 엑셀(.xlsx) 파싱 + DB 매칭 dry-run.
 *
 * 시트 구조:
 *   - 한 행 = 한 제품의 한 변형(방문형/셀프형 또는 단일)
 *   - 각 셀은 newline 분리된 multiple options (의무기간 36/48/60/72/84 등)
 *   - 컬럼: 품목 / 제품코드요약 / 제품코드 / 컬러/사이즈 / 의무기간 / 소유권기간 / 관리주기 / 운영가 / 4월 판촉가 / 수수료 / 비고
 *
 * 매핑 (60개월 기준 우선):
 *   Product.rentalPrice         ← 운영가 (기본 할인)
 *   Product.cardDiscountPrice   ← 4월 판촉가 (전사 할인)
 *   HqPolicy.baseCommission     ← 수수료 합계 (vat 제외)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직 26년 4월 정책 (부가세 제외 , -0)_1.xlsx";

type PolicyOption = {
  productCode: string;
  managementMode: "방문형" | "셀프형" | null;
  variantLabel: string;       // 컬러/사이즈 원본 텍스트
  contractPeriod: number;
  ownershipPeriod: number | null;
  visitInterval: string;
  operationPrice: number | null;     // 운영가 (기본 할인)
  promotionPrice: number | null;     // 4월 판촉가
  commissionTotal: number | null;    // 수수료 합계 vat 제외
  remark: string;
};

function parseNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const trimmed = String(s).trim();
  if (!trimmed || trimmed === "-" || trimmed.toUpperCase() === "X") return null;
  const cleaned = trimmed.replace(/[, \s원]/g, "");
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

function detectMode(label: string): "방문형" | "셀프형" | null {
  if (/방문/.test(label)) return "방문형";
  if (/셀프|자가/.test(label)) return "셀프형";
  return null;
}

function splitLines(s: string | null | undefined): string[] {
  if (s == null) return [];
  return String(s).split(/[\n\r]+/).map(t => t.trim()).filter(t => t.length > 0);
}

function parseSheet(): PolicyOption[] {
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

  const out: PolicyOption[] = [];
  let lastProductCode = "";

  // R001~R004는 헤더 영역. 데이터는 R005부터.
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] ?? [];
    // 컬럼 인덱스 (0-based):
    //  0: 품목 / 1: 제품코드 요약 / 2: 제품코드 / 3: 컬러/사이즈
    //  4: 의무기간 / 5: 소유권기간 / 6: 관리주기 (직접방문)
    //  7: 운영가 / 8: 4월 판촉가 / 9: 수수료 합계 / 10: 비고
    const productCode = String(r[2] ?? "").trim();
    const variantLabel = String(r[3] ?? "").trim();

    // 같은 모델의 색상 변형 행은 productCode가 비어있고 컬러만 변경. lastProductCode 상속.
    const code = productCode || lastProductCode;
    if (productCode) lastProductCode = productCode;
    if (!code) continue;
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue; // model code 형식 필터

    const contractLines  = splitLines(r[4] as string);
    const ownershipLines = splitLines(r[5] as string);
    const visitLines     = splitLines(r[6] as string);
    const opPriceLines   = splitLines(r[7] as string);
    const promoLines     = splitLines(r[8] as string);
    const commLines      = splitLines(r[9] as string);
    const remark         = String(r[10] ?? "").trim();

    // 옵션 개수 = 의무기간 라인 수 기준
    const n = contractLines.length;
    if (n === 0) continue;

    const mode = detectMode(variantLabel);

    for (let k = 0; k < n; k++) {
      const period = Number(contractLines[k]);
      if (!isFinite(period)) continue;

      out.push({
        productCode: code,
        managementMode: mode,
        variantLabel,
        contractPeriod: period,
        ownershipPeriod: ownershipLines[k] ? Number(ownershipLines[k]) : null,
        visitInterval: visitLines[k] ?? visitLines[0] ?? "",
        operationPrice: parseNumber(opPriceLines[k]),
        promotionPrice: parseNumber(promoLines[k]),
        commissionTotal: parseNumber(commLines[k]),
        remark,
      });
    }
  }

  return out;
}

async function main() {
  const options = parseSheet();
  console.log(`📊 시트에서 ${options.length}개 정책 옵션 파싱`);

  const byCode = new Map<string, PolicyOption[]>();
  for (const o of options) {
    if (!byCode.has(o.productCode)) byCode.set(o.productCode, []);
    byCode.get(o.productCode)!.push(o);
  }
  console.log(`📦 고유 productCode: ${byCode.size}개`);

  // 60개월 기준 옵션만 추출 (관리모드별)
  type RepOption = PolicyOption;
  const repByCode = new Map<string, { 방문형?: RepOption; 셀프형?: RepOption; 단일?: RepOption }>();
  for (const [code, opts] of byCode) {
    const sixty = opts.filter(o => o.contractPeriod === 60);
    if (sixty.length === 0) continue;
    const rec: { 방문형?: RepOption; 셀프형?: RepOption; 단일?: RepOption } = {};
    for (const o of sixty) {
      if (o.managementMode === "방문형") rec.방문형 = o;
      else if (o.managementMode === "셀프형") rec.셀프형 = o;
      else rec.단일 = o;
    }
    repByCode.set(code, rec);
  }

  // DB 매칭
  const products = await prisma.product.findMany({
    select: { id: true, productCode: true, name: true, managementType: true, rentalPrice: true, cardDiscountPrice: true },
  });
  console.log(`🗃️  DB Product: ${products.length}개\n`);

  let matched = 0;
  let unmatchedDb = 0;
  let unmatchedXlsx = 0;
  const matches: Array<{
    code: string;
    name: string;
    chosenMode: string;
    dbRental: number;
    xlsxRental: number | null;
    dbCard: number | null;
    xlsxCard: number | null;
    commission: number | null;
  }> = [];

  for (const p of products) {
    const rec = repByCode.get(p.productCode);
    if (!rec) { unmatchedDb++; continue; }

    // 우리 managementType과 매칭되는 mode 선택
    let chosen: RepOption | undefined;
    let chosenMode: string;
    if (p.managementType.includes("자가") || p.managementType.includes("셀프")) {
      chosen = rec.셀프형 ?? rec.단일 ?? rec.방문형;
      chosenMode = "셀프형(=자가)";
    } else if (p.managementType.includes("방문")) {
      chosen = rec.방문형 ?? rec.단일 ?? rec.셀프형;
      chosenMode = "방문형";
    } else {
      chosen = rec.단일 ?? rec.방문형 ?? rec.셀프형;
      chosenMode = "단일";
    }
    if (!chosen) { unmatchedDb++; continue; }

    matched++;
    matches.push({
      code: p.productCode,
      name: p.name,
      chosenMode,
      dbRental: p.rentalPrice,
      xlsxRental: chosen.operationPrice,
      dbCard: p.cardDiscountPrice,
      xlsxCard: chosen.promotionPrice,
      commission: chosen.commissionTotal,
    });
  }

  // 시트엔 있는데 DB에 없는 코드
  for (const code of repByCode.keys()) {
    if (!products.find(p => p.productCode === code)) unmatchedXlsx++;
  }

  console.log("══ 매칭 결과 ══");
  console.log(`  매칭 성공     : ${matched}개`);
  console.log(`  DB에만 있음   : ${unmatchedDb}개 (시트에 없는 모델)`);
  console.log(`  시트에만 있음 : ${unmatchedXlsx}개 (DB에 없는 모델)\n`);

  console.log("══ 매칭된 항목 — 가격 차이 비교 (60개월) ══");
  console.log(`${"productCode".padEnd(15)} ${"이름".padEnd(28)} ${"모드".padEnd(12)} ${"DB rental".padStart(10)} ${"시트 운영가".padStart(12)} ${"DB card".padStart(10)} ${"시트 판촉가".padStart(12)} ${"수수료".padStart(10)}`);
  for (const m of matches) {
    const rentalDiff = m.xlsxRental != null && m.xlsxRental !== m.dbRental ? " ⚠" : "";
    const cardDiff = m.xlsxCard != null && m.xlsxCard !== m.dbCard ? " ⚠" : "";
    console.log(
      `${m.code.padEnd(15)} ${(m.name.slice(0, 28)).padEnd(28)} ${m.chosenMode.padEnd(12)} ` +
      `${String(m.dbRental).padStart(10)} ${(m.xlsxRental ?? "—").toString().padStart(12)}${rentalDiff} ` +
      `${(m.dbCard ?? "—").toString().padStart(10)} ${(m.xlsxCard ?? "—").toString().padStart(12)}${cardDiff} ` +
      `${(m.commission ?? "—").toString().padStart(10)}`
    );
  }

  console.log("\n══ DB에만 있고 시트에 없는 코드 ══");
  for (const p of products) {
    if (!repByCode.has(p.productCode)) console.log(`  ${p.productCode}  ${p.name}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
