/**
 * 5월 정책 엑셀에서 상품별 distinct 색상 옵션 추출.
 * dry-run 기본 (출력만). --apply 인자 주면 Product.specs["색상"] 에 저장.
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
const APPLY = process.argv.includes("--apply");

function extractColor(label: string): string {
  return label
    .replace(/\*\s*(방문형|셀프형|Lite|기본형)\s*\*/gi, "")
    .replace(/[\n\r|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseColors(): Map<string, string[]> {
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets[SHEET];
  if (!sheet) throw new Error(`sheet "${SHEET}" not found`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

  const byCode = new Map<string, Set<string>>();
  let lastCode = "";

  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeRaw = String(r[2] ?? "").trim();
    const code = codeRaw || lastCode;
    if (codeRaw) lastCode = codeRaw;
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;

    const variantLabel = String(r[3] ?? "").trim();
    if (!variantLabel) continue;

    const discontText = `${r[17] ?? ""}${r[18] ?? ""}${r[19] ?? ""}`;
    if (/단종|운영중지|미운영/.test(discontText)) continue;
    if (/운영종료/.test(discontText) && !/통합운영/.test(discontText)) continue;

    const color = extractColor(variantLabel);
    if (!color) continue;

    const set = byCode.get(code) ?? new Set<string>();
    set.add(color);
    byCode.set(code, set);
  }

  const result = new Map<string, string[]>();
  for (const [code, set] of byCode) result.set(code, [...set]);
  return result;
}

async function main() {
  const map = parseColors();
  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: { id: true, productCode: true, name: true, specs: true },
  });

  let withColors = 0;
  let appliedCount = 0;
  const noColor: string[] = [];

  for (const p of products) {
    const colors = map.get(p.productCode);
    if (!colors || colors.length === 0) {
      noColor.push(`${p.productCode} (${p.name})`);
      continue;
    }
    withColors++;
    const colorStr = colors.join(",");
    const existingSpecs = (p.specs as Record<string, string> | null) ?? {};
    const existingColor = existingSpecs["색상"];
    const sameAsExisting = existingColor === colorStr;
    console.log(`${p.productCode} (${p.name})`);
    console.log(`  → [${colors.join(", ")}]${sameAsExisting ? " (변경 없음)" : existingColor ? ` (현재 "${existingColor}" → 갱신)` : ""}`);
    if (APPLY && !sameAsExisting) {
      const newSpecs = { ...existingSpecs, 색상: colorStr };
      await prisma.product.update({ where: { id: p.id }, data: { specs: newSpecs } });
      appliedCount++;
    }
  }

  console.log();
  console.log(`active ${products.length}개 / 색상 추출 ${withColors}개 / 색상 없음 ${noColor.length}개`);
  if (APPLY) console.log(`💾 적용: ${appliedCount}개 상품 specs.색상 갱신`);
  if (!APPLY) console.log("ℹ︎ dry-run. --apply 인자로 실제 갱신");
  if (noColor.length > 0 && noColor.length <= 20) {
    console.log("\n색상 없음 상품:");
    noColor.forEach(c => console.log(`  · ${c}`));
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
