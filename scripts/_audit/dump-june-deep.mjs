import xlsx from "xlsx";
const path = process.argv[2] || "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx";
const wb = xlsx.readFile(path);
console.log(`📁 ${path}`);
console.log(`📋 시트: ${wb.SheetNames.join(", ")}\n`);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const range = xlsx.utils.decode_range(ws["!ref"] ?? "A1");
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  console.log(`──── [${name}] (${range.e.r + 1} rows × ${range.e.c + 1} cols) total=${rows.length} ────`);
  // print first 20 rows and any rows that look like data (productCode pattern)
  const max = Math.min(rows.length, 30);
  for (let i = 0; i < max; i++) {
    const cells = (rows[i] ?? []).map(c => c == null ? "" : String(c).slice(0, 22));
    console.log(`  R${String(i + 1).padStart(3, "0")}: ${cells.join(" | ")}`);
  }
  // Look for the first data row containing a productCode
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const code = String(r[2] ?? "").trim();
    if (/^[A-Z][A-Z0-9]{6,}$/.test(code)) {
      console.log(`\n  ▶ 첫 데이터 행: R${i + 1} (index=${i}) — productCode=${code}`);
      // dump 3 rows from here
      for (let j = i; j < Math.min(i + 3, rows.length); j++) {
        const cs = (rows[j] ?? []).map(c => c == null ? "" : String(c).slice(0, 22));
        console.log(`     R${String(j + 1).padStart(3, "0")}: ${cs.join(" | ")}`);
      }
      break;
    }
  }
  console.log("");
}
