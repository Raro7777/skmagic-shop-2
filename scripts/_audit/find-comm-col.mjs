// Find commission column in June file by looking for the "수수료 합계" header and matching data
import xlsx from "xlsx";
const wb = xlsx.readFile("/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx");
const ws = wb.Sheets["판매수수료_6월"];

// Look at the merged range to understand cell layout
console.log("Merges:");
for (const m of (ws["!merges"] ?? []).slice(0, 40)) {
  console.log(`  ${xlsx.utils.encode_range(m)}`);
}

const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

// Print full row 10/11/12 with column indices to see all
console.log("\nFull header rows (R10-R12) with all 22 cols:");
for (const i of [9, 10, 11]) {
  console.log(`\nR${i+1}:`);
  const r = rows[i] ?? [];
  for (let j = 0; j < 22; j++) {
    console.log(`  [${String(j).padStart(2)}] ${r[j] == null ? "<NULL>" : String(r[j]).replace(/\n/g, " / ").slice(0, 50)}`);
  }
}

// Find data row with numeric values in col 16/17/18 (around 수수료 합계 area)
console.log("\n\n샘플 데이터 row 50, 100, 200 (each col):");
for (const i of [50, 100, 200, 300, 400]) {
  console.log(`\nR${i+1}:`);
  const r = rows[i] ?? [];
  for (let j = 0; j < 22; j++) {
    console.log(`  [${String(j).padStart(2)}] ${r[j] == null ? "<NULL>" : String(r[j]).slice(0, 30)}`);
  }
}
