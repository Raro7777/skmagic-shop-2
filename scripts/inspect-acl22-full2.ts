import * as XLSX from "xlsx";

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정_v4_복호화.xlsx";
const SHEET = "판매수수료_5월";
const wb = XLSX.readFile(PATH);
const sheet = wb.Sheets[SHEET];
const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

console.log("=== Header rows 8~12 ===");
for (let i = 7; i <= 11; i++) {
  const r = rows[i] ?? [];
  for (let c = 0; c < 22; c++) {
    const v = String(r[c] ?? "").trim().replace(/\n/g, "↵");
    if (v) console.log(`  row${i + 1}[${c}]: "${v}"`);
  }
  console.log();
}

console.log("=== ACL22C1ASKOB 전체 (row 67~82) ===");
let lastCode = "";
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] ?? [];
  const codeRaw = String(r[2] ?? "").trim();
  const code = codeRaw || lastCode;
  if (codeRaw) lastCode = codeRaw;
  if (code !== "ACL22C1ASKOB") continue;
  const variantLabel = String(r[3] ?? "").trim().replace(/\n/g, " | ");
  const period = String(r[4] ?? "").trim();
  const ownership = String(r[5] ?? "").trim();
  const visit = String(r[6] ?? "").trim();
  console.log(`row${i + 1}: 의무${period}/소유${ownership} | "${variantLabel}" | [7]=${r[7]} [8]=${r[8]} [9]=${r[9]} [10]=${r[10]} [11]=${r[11]} [12]=${r[12]} [15]=${r[15]} [16]=${r[16]} | 단종=[17-19]=${(r[17]??"")}${(r[18]??"")}${(r[19]??"")}`);
}
