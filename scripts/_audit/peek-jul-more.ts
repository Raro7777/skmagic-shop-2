import * as XLSX from "xlsx";
const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_7월_제품_수수료표_0630_수정v12_1.xlsx";
const wb = XLSX.readFile(PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
console.log(`총 ${rows.length} 행`);
// 헤더 있을만한 위치 찾기
for (let i = 12; i < Math.min(35, rows.length); i++) {
  const r = rows[i] as unknown[];
  if (r.filter(v => String(v).trim() !== "").length > 3) {
    console.log(`[r${i+1}] ` + r.slice(0, 15).map(v => String(v ?? "").slice(0, 14)).join(" | "));
  }
}
console.log("\n--- 데이터 샘플 ---");
for (let i = 33; i < Math.min(45, rows.length); i++) {
  const r = rows[i] as unknown[];
  console.log(`[r${i+1}] ` + r.slice(0, 15).map(v => String(v ?? "").slice(0, 14)).join(" | "));
}
