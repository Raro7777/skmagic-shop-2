import * as XLSX from "xlsx";
const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_7월_제품_수수료표_0630_수정v12_1.xlsx";

const wb = XLSX.readFile(PATH);
console.log("=== 시트 목록 ===");
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  console.log(`  [${name}]  rows=${range.e.r + 1}  cols=${range.e.c + 1}`);
}
console.log();
console.log("=== 첫 3 시트 상단 몇 행 미리보기 ===");
for (const name of wb.SheetNames.slice(0, 3)) {
  console.log(`\n--- [${name}] ---`);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { header: 1, defval: "" });
  for (const r of rows.slice(0, 4)) {
    const arr = r as unknown as unknown[];
    console.log("  " + arr.slice(0, 10).map(v => String(v ?? "").slice(0, 12)).join(" | "));
  }
}
