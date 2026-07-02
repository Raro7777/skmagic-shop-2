import * as XLSX from "xlsx";
const wb = XLSX.readFile("/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_7월_제품_수수료표_0630_수정v12_1.xlsx");
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
console.log("=== MEGA ICE 옵션 상세 ===");
let cm = "";
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] as unknown[];
  const code = String(r[2] ?? "").trim();
  if (String(r[3] ?? "").trim()) cm = String(r[3]).trim();
  if (!code.startsWith("WPUIAC506SNS")) continue;
  console.log(`[r${i+1}] ${code} ${cm.split("\n").pop()}  의무=${r[4]} 관리=${r[6]}  기준=${r[7]} 운영=${r[8]} 판촉=${r[9]} 타사=${r[10]} | 기본수수료=${r[11]} 판촉수수료=${r[12]} 핵심②=${r[13]} 핵심③=${r[14]} 주력④=${r[15]} 주력⑤=${r[16]} 합계=${r[17]}`);
  if (i > 60) break;
}
