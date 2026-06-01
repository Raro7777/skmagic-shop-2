import xlsx from "xlsx";
const wb = xlsx.readFile("/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx");
console.log("=== Sheets ===");
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const range = xlsx.utils.decode_range(ws["!ref"] ?? "A1");
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  console.log(`\n[${name}] dims=${range.e.r+1}×${range.e.c+1} rows=${rows.length}`);
  // 첫 5행 미리보기
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const r = rows[i];
    const cells = r.map(c => c === null ? "" : String(c).slice(0, 18)).join(" | ");
    console.log(`  ${i}: ${cells}`);
  }
}
