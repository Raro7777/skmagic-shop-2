import * as XLSX from "xlsx";

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정_v4_복호화.xlsx";
const SHEET = "판매수수료_5월";
const DATA_START_ROW = 12;
const TARGET = "ACL22C1ASKOB";

const wb = XLSX.readFile(PATH);
const sheet = wb.Sheets[SHEET];
const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

// 헤더 (row 10/11) 출력
console.log("=== Header rows (10, 11) ===");
for (let i = 10; i <= 11; i++) {
  const r = rows[i] ?? [];
  for (let c = 0; c < 22; c++) {
    const v = String(r[c] ?? "").trim().replace(/\n/g, "↵");
    if (v) console.log(`  row${i + 1}[${c}]: "${v}"`);
  }
  console.log();
}

console.log(`=== ${TARGET} 모든 행 (전체 컬럼 0~21) ===`);
let lastCode = "";
for (let i = DATA_START_ROW; i < rows.length; i++) {
  const r = rows[i] ?? [];
  const codeRaw = String(r[2] ?? "").trim();
  const code = codeRaw || lastCode;
  if (codeRaw) lastCode = codeRaw;
  if (code !== TARGET) continue;
  console.log(`\nrow ${i + 1}:`);
  for (let c = 0; c < 22; c++) {
    const v = String(r[c] ?? "").trim().replace(/\n/g, "↵");
    if (v) console.log(`  [${c}]: ${v}`);
  }
}
