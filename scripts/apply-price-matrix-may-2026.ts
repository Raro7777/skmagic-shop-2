/**
 * SK매직 5월 정책 시트의 (운영모드 × 약정기간) 옵션을
 * Product.priceMatrix JSON 배열로 적재 — 5월 버전.
 *
 * 5월 시트 형식: row 당 1개 의무기간 (4월처럼 \n 묶여 있지 않음).
 * 컬럼: [2]productCode, [3]컬러/모드, [4]의무기간, [5]소유권, [6]관리주기,
 *       [8]운영가, [9]5월판촉가, [15]수수료합계, [17-19]단종/비고.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정_v4_복호화.xlsx";
const SHEET = "판매수수료_5월";
const DATA_START_ROW = 12;

export type PriceOption = {
  mode: "방문형" | "셀프형" | null;
  variantLabel: string;
  contractPeriod: number;
  ownershipPeriod: number | null;
  visitInterval: string;
  rentalPrice: number | null;
  cardDiscountPrice: number | null;
  baseCommission: number | null;
};

function parseNumber(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || t === "-" || t.toUpperCase() === "X") return null;
  const n = Number(t.replace(/[, \s원]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function detectMode(label: string): "방문형" | "셀프형" | null {
  if (/방문/.test(label)) return "방문형";
  if (/셀프|자가|Lite/i.test(label)) return "셀프형"; // Lite 는 셀프형 계열로 묶음 (4월 룰 유지)
  return null;
}

function parseAll(): Map<string, PriceOption[]> {
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets[SHEET];
  if (!sheet) throw new Error(`시트 "${SHEET}" 없음`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

  const byCode = new Map<string, PriceOption[]>();
  const lastModeForCode: Record<string, "방문형" | "셀프형" | null> = {};
  let lastCode = "";

  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeRaw = String(r[2] ?? "").trim();
    const code = codeRaw || lastCode;
    if (codeRaw) {
      lastCode = codeRaw;
      if (!(code in lastModeForCode)) lastModeForCode[code] = null;
    }
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;

    const variantLabel = String(r[3] ?? "").trim();
    const period = parseNumber(String(r[4] ?? ""));
    if (!period) continue;

    const discontText = `${r[17] ?? ""}${r[18] ?? ""}${r[19] ?? ""}`;
    // "운영종료 + 통합운영"은 다른 변형 코드(예: SSWH)가 종료되고 현재 코드(SKWH)는 통합 운영되는 행이라 살림.
    if (/단종|운영중지|미운영/.test(discontText)) continue;
    if (/운영종료/.test(discontText) && !/통합운영/.test(discontText)) continue;

    const detected = detectMode(variantLabel);
    const mode = detected ?? lastModeForCode[code] ?? null;
    if (detected) lastModeForCode[code] = detected;

    const opts = byCode.get(code) ?? [];
    opts.push({
      mode,
      variantLabel,
      contractPeriod: period,
      ownershipPeriod: parseNumber(String(r[5] ?? "")),
      visitInterval: String(r[6] ?? "").trim(),
      rentalPrice: parseNumber(String(r[8] ?? "")),
      cardDiscountPrice: parseNumber(String(r[9] ?? "")),
      baseCommission: parseNumber(String(r[15] ?? "")),
    });
    byCode.set(code, opts);
  }
  return byCode;
}

async function main() {
  const matrix = parseAll();
  const products = await prisma.product.findMany({ select: { id: true, productCode: true, name: true } });

  let touched = 0, totalOptions = 0, multiMode = 0, single = 0, unmatched = 0;

  for (const p of products) {
    const opts = matrix.get(p.productCode);
    if (!opts || opts.length === 0) { unmatched++; continue; }

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

    const modeRank = (m: string | null) => (m === "방문형" ? 0 : m === "셀프형" ? 1 : 2);
    cleaned.sort((a, b) => {
      const r = modeRank(a.mode) - modeRank(b.mode);
      if (r !== 0) return r;
      return a.contractPeriod - b.contractPeriod;
    });

    const modes = new Set(cleaned.map(o => o.mode));
    if (modes.size > 1) multiMode++; else single++;

    await prisma.product.update({
      where: { id: p.id },
      data: { priceMatrix: cleaned as never },
    });
    touched++;
    totalOptions += cleaned.length;
  }

  console.log(`📊 Price Matrix (5월) 적용 결과`);
  console.log(`  적용 상품 : ${touched}개 (옵션 합계 ${totalOptions}개, 평균 ${(totalOptions / Math.max(1, touched)).toFixed(1)})`);
  console.log(`  단일 모드 : ${single}개`);
  console.log(`  멀티 모드 : ${multiMode}개  (방문형 + 셀프형 둘 다)`);
  console.log(`  매칭 실패 : ${unmatched}개`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
