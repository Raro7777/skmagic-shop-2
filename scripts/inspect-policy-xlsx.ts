import * as XLSX from "xlsx";

const path = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직 26년 4월 정책 (부가세 제외 , -0)_1.xlsx";

const wb = XLSX.readFile(path);
console.log(`📁 파일: ${path}`);
console.log(`📋 시트: ${wb.SheetNames.join(", ")}`);
console.log("");

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  console.log(`──── [${name}] (${range.e.r + 1} rows × ${range.e.c + 1} cols) ────`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
  // Print first 30 rows to understand structure
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = (rows[i] ?? []).map(c => (c == null ? "" : String(c).slice(0, 40)));
    console.log(`  R${String(i + 1).padStart(3, "0")}: ${cells.join(" | ")}`);
  }
  if (rows.length > 30) console.log(`  ... +${rows.length - 30} more rows`);
  console.log("");
}
