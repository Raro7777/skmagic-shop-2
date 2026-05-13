import * as XLSX from "xlsx";
const wb = XLSX.readFile("/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직 26년 4월 정책 (부가세 제외 , -0)_1.xlsx");
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
console.log("col count:", Math.max(...rows.map(r => r?.length ?? 0)));
for (let i = 0; i < 6; i++) {
  console.log(`\nR${i+1}:`);
  (rows[i] ?? []).forEach((c, j) => console.log(`  [${j}] ${c == null ? "(null)" : JSON.stringify(String(c))}`));
}
// print row 6 full (data)
console.log("\nR6 full data row:");
(rows[5] ?? []).forEach((c, j) => console.log(`  [${j}] ${c == null ? "(null)" : JSON.stringify(String(c))}`));
