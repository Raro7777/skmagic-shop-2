// Find discontinued markers in June file
import xlsx from "xlsx";
const wb = xlsx.readFile("/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx");
const rows = xlsx.utils.sheet_to_json(wb.Sheets["판매수수료_6월"], { header: 1, defval: null, raw: false });

let countDiscont = 0;
let countOperEnd = 0;
let countOperEndIntegrated = 0;
const samples = [];
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] ?? [];
  const code = String(r[2] ?? "").trim();
  const c19 = String(r[19] ?? "").trim();
  const c20 = String(r[20] ?? "").trim();
  const c18 = String(r[18] ?? "").trim();
  const combo = `${c18}|${c19}|${c20}`;
  if (/단종|운영중지|미운영/.test(combo)) {
    countDiscont++;
    if (samples.length < 10) samples.push(`R${i+1} ${code}: ${combo}`);
  }
  if (/운영종료/.test(combo)) {
    countOperEnd++;
    if (/통합운영/.test(combo)) countOperEndIntegrated++;
    if (samples.length < 20) samples.push(`R${i+1} ${code}: ${combo}`);
  }
}
console.log(`단종/운영중지/미운영: ${countDiscont}건`);
console.log(`운영종료: ${countOperEnd}건 (통합운영 포함: ${countOperEndIntegrated}건)`);
console.log("\n샘플:");
for (const s of samples) console.log(s);

// Also check raw column 17 18 19 to confirm
console.log("\n=== 단종/운영중지 컬럼 위치 확인 ===");
// 6월 헤더: [17] 출시, [18] 단종/운영중지, [19] 비고
// 즉 columns 18, 19 ((+ 20도 비어있는 비고면) check
let nonEmpty18 = 0, nonEmpty19 = 0, nonEmpty20 = 0;
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] ?? [];
  if (r[18] != null && String(r[18]).trim()) nonEmpty18++;
  if (r[19] != null && String(r[19]).trim()) nonEmpty19++;
  if (r[20] != null && String(r[20]).trim()) nonEmpty20++;
}
console.log(`non-empty col[18]: ${nonEmpty18}, col[19]: ${nonEmpty19}, col[20]: ${nonEmpty20}`);
