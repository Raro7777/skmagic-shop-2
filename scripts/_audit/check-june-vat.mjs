// Verify VAT: rentalPrice (col[8] 운영가) sample 3개 and 수수료합계 (col[17]) sample 3개
import xlsx from "xlsx";
const wb = xlsx.readFile("/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx");
const rows = xlsx.utils.sheet_to_json(wb.Sheets["판매수수료_6월"], { header: 1, defval: null, raw: false });

function parseNum(s) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || t === "-" || t.toUpperCase() === "X") return null;
  const n = Number(t.replace(/[, \s원]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const codes = new Set();
const samples = [];
const commSamples = [];
const rentalSamples = [];
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] ?? [];
  const code = String(r[2] ?? "").trim();
  if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;
  codes.add(code);

  const rental = parseNum(r[8]);
  const comm = parseNum(r[17]);  // 6월: col 17 = 수수료합계

  if (rental && samples.length < 10) {
    samples.push({ code, mode: String(r[3]??"").replace(/\n/g,"/"), period: r[4], rental });
  }
  if (comm) commSamples.push(comm);
  if (rental) rentalSamples.push(rental);
}
console.log(`고유 productCode: ${codes.size}개`);
console.log(`\n샘플 rentalPrice (col[8] 운영가):`);
for (const s of samples) {
  const div = s.rental / 1.1;
  console.log(`  ${s.code} ${s.mode.slice(0,12)} ${s.period}m: ${s.rental.toLocaleString()} ÷1.1 = ${div.toFixed(2)} → 공급가 ${Math.round(div).toLocaleString()}`);
}

console.log(`\n수수료합계 (col[17]) 통계: 합=${commSamples.length}건, min=${Math.min(...commSamples).toLocaleString()}, max=${Math.max(...commSamples).toLocaleString()}`);
console.log(`운영가 (col[8]) 통계: 합=${rentalSamples.length}건, min=${Math.min(...rentalSamples).toLocaleString()}, max=${Math.max(...rentalSamples).toLocaleString()}`);

// VAT check: 운영가는 보통 끝자리 -900, -800 등 VAT 포함 (네자리 -900)
// 수수료합계는 VAT 포함이라 -000 또는 -700 등 다양
const last3 = {};
for (const c of commSamples.slice(0,50)) {
  const k = String(c % 1000).padStart(3, "0");
  last3[k] = (last3[k] ?? 0) + 1;
}
console.log("\n수수료합계 끝3자리 분포 (상위 50건):", last3);
