/**
 * SK매직 4월 정책 시트의 모든 (운영모드 × 약정기간) 옵션을
 * Product.priceMatrix JSON 배열로 적재.
 *
 * 한 productCode에 여러 운영모드(방문형/Lite·셀프형)가 있는 경우 모두 포함.
 * 단일 운영모드만 있는 경우엔 mode=null로 단일 그룹.
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

export type PriceOption = {
  mode: "방문형" | "셀프형" | null;
  variantLabel: string;        // 컬러/사이즈 표시 그대로 (예: "* Lite *\n네이비")
  contractPeriod: number;      // 의무기간 (개월)
  ownershipPeriod: number | null;
  visitInterval: string;       // "4개월" | "12개월" | ""
  rentalPrice: number | null;  // 운영가
  cardDiscountPrice: number | null; // 4월 판촉가
  baseCommission: number | null;    // 수수료 합계 (vat 제외)
};

function parseNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = String(s).trim();
  if (!t || t === "-" || t.toUpperCase() === "X") return null;
  const n = Number(t.replace(/[, \s원]/g, ""));
  return isFinite(n) ? n : null;
}
function detectMode(label: string): "방문형" | "셀프형" | null {
  if (/방문/.test(label)) return "방문형";
  if (/셀프|자가|Lite/i.test(label)) return "셀프형";
  return null;
}
function splitLines(s: string | null | undefined): string[] {
  if (s == null) return [];
  return String(s).split(/[\n\r]+/).map(t => t.trim()).filter(t => t.length > 0);
}

function parseAll(): Map<string, PriceOption[]> {
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

  const byCode = new Map<string, PriceOption[]>();
  // 같은 productCode 내에서 라벨이 비어있는 행은 직전 mode를 상속한다
  const lastModeForCode: Record<string, "방문형" | "셀프형" | null> = {};
  let lastCode = "";
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeRaw = String(r[2] ?? "").trim();
    const code = codeRaw || lastCode;
    if (codeRaw) {
      lastCode = codeRaw;
      // 새 productCode가 시작되면 mode 상속 끊기
      if (!(code in lastModeForCode)) lastModeForCode[code] = null;
    }
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;

    const variantLabel = String(r[3] ?? "").trim();
    const contracts = splitLines(r[4] as string);
    const ownerships = splitLines(r[5] as string);
    const visits = splitLines(r[6] as string);
    const opPrices = splitLines(r[7] as string);
    const promos = splitLines(r[8] as string);
    const comms = splitLines(r[9] as string);

    if (contracts.length === 0) continue;

    // 라벨에서 mode 감지 — 없으면 직전 mode 상속
    const detected = detectMode(variantLabel);
    const mode = detected ?? lastModeForCode[code] ?? null;
    if (detected) lastModeForCode[code] = detected;
    const opts = byCode.get(code) ?? [];

    for (let k = 0; k < contracts.length; k++) {
      const period = Number(contracts[k]);
      if (!isFinite(period)) continue;
      opts.push({
        mode,
        variantLabel,
        contractPeriod: period,
        ownershipPeriod: ownerships[k] ? Number(ownerships[k]) : null,
        visitInterval: visits[k] ?? visits[0] ?? "",
        rentalPrice: parseNumber(opPrices[k]),
        cardDiscountPrice: parseNumber(promos[k]),
        baseCommission: parseNumber(comms[k]),
      });
    }
    byCode.set(code, opts);
  }
  return byCode;
}

async function main() {
  const matrix = parseAll();
  const products = await prisma.product.findMany({ select: { id: true, productCode: true, name: true } });

  let touched = 0;
  let totalOptions = 0;
  let multiMode = 0;
  let single = 0;
  let unmatched = 0;

  for (const p of products) {
    const opts = matrix.get(p.productCode);
    if (!opts || opts.length === 0) { unmatched++; continue; }

    // null 가격 제거 + (mode, contractPeriod, visitInterval) 기준 dedupe
    const seen = new Set<string>();
    const cleaned: PriceOption[] = [];
    for (const o of opts) {
      if (o.rentalPrice == null) continue;
      const key = `${o.mode ?? "null"}|${o.contractPeriod}|${o.visitInterval}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(o);
    }
    if (cleaned.length === 0) { unmatched++; continue; }

    // 정렬: 방문형 먼저 → 셀프형 → 단일, 같은 mode 내에선 contractPeriod 오름차순
    const modeRank = (m: string | null) => (m === "방문형" ? 0 : m === "셀프형" ? 1 : 2);
    cleaned.sort((a, b) => {
      const r = modeRank(a.mode) - modeRank(b.mode);
      if (r !== 0) return r;
      return a.contractPeriod - b.contractPeriod;
    });

    const modes = new Set(cleaned.map(o => o.mode));
    if (modes.size > 1) multiMode++;
    else single++;

    await prisma.product.update({
      where: { id: p.id },
      data: { priceMatrix: cleaned as never },
    });
    touched++;
    totalOptions += cleaned.length;
  }

  console.log(`\n📊 Price Matrix 적용 결과`);
  console.log(`  적용 상품 : ${touched}개 (옵션 합계 ${totalOptions}개, 평균 ${(totalOptions / Math.max(1, touched)).toFixed(1)})`);
  console.log(`  단일 모드 : ${single}개`);
  console.log(`  멀티 모드 : ${multiMode}개  (방문형 + 셀프형 둘 다 노출)`);
  console.log(`  매칭 실패 : ${unmatched}개  (priceMatrix 미설정 — 단일 가격만 표시)`);

  // 멀티모드 샘플
  console.log(`\n=== 멀티 모드 상품 샘플 ===`);
  for (const p of products) {
    const opts = matrix.get(p.productCode);
    if (!opts) continue;
    const cleaned = opts.filter(o => o.rentalPrice != null);
    const modes = new Set(cleaned.map(o => o.mode));
    if (modes.size > 1) {
      console.log(`\n${p.productCode}  ${p.name}`);
      for (const m of [...modes]) {
        const sub = cleaned.filter(o => o.mode === m);
        console.log(`  [${m ?? "단일"}] ${sub.length}개 옵션:`);
        for (const o of sub) {
          console.log(`    ${o.contractPeriod}개월 / ${o.visitInterval} : ${o.rentalPrice?.toLocaleString()}원${o.cardDiscountPrice ? ` (카드 ${o.cardDiscountPrice.toLocaleString()})` : ""}`);
        }
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
