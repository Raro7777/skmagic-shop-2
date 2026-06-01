// Compare May v4 vs June v2 column-by-column on data row (row 13 / index 12)
import xlsx from "xlsx";

function load(path, sheet) {
  const wb = xlsx.readFile(path);
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`no sheet ${sheet} in ${path}`);
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
}

const MAY = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정v4.xlsx";
const JUN = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx";

const may = load(MAY, "판매수수료_5월");
const jun = load(JUN, "판매수수료_6월");

console.log("=== Header (R10/R11/R12) 비교 ===");
console.log("\n5월:");
for (const i of [9, 10, 11]) {
  console.log(`R${i+1}:`);
  (may[i] ?? []).forEach((c, idx) => {
    if (c != null && String(c).trim()) console.log(`  [${idx}] ${String(c).replace(/\n/g, " / ").slice(0, 40)}`);
  });
}
console.log("\n6월:");
for (const i of [9, 10, 11]) {
  console.log(`R${i+1}:`);
  (jun[i] ?? []).forEach((c, idx) => {
    if (c != null && String(c).trim()) console.log(`  [${idx}] ${String(c).replace(/\n/g, " / ").slice(0, 40)}`);
  });
}

console.log("\n=== 첫 데이터 행 비교 ===");
console.log("\n5월 첫 데이터 (R13~R15) - 21 cols:");
for (const i of [12, 13, 14]) {
  console.log(`R${i+1}:`);
  (may[i] ?? []).forEach((c, idx) => {
    console.log(`  [${idx}] ${c == null ? "<NULL>" : String(c).replace(/\n/g, " / ").slice(0, 30)}`);
  });
}
console.log("\n6월 첫 데이터 (R13~R15) - 22 cols:");
for (const i of [12, 13, 14]) {
  console.log(`R${i+1}:`);
  (jun[i] ?? []).forEach((c, idx) => {
    console.log(`  [${idx}] ${c == null ? "<NULL>" : String(c).replace(/\n/g, " / ").slice(0, 30)}`);
  });
}
