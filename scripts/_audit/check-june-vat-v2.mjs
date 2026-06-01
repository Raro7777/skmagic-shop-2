// VAT 검증 — col[16]이 수수료 합계
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

const samples = [];
const commSamples = [];
const rentalSamples = [];
const codes = new Set();
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] ?? [];
  const code = String(r[2] ?? "").trim();
  if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;
  codes.add(code);

  const rental = parseNum(r[8]);
  const comm = parseNum(r[16]);

  if (rental && samples.length < 8) {
    samples.push({ code, mode: String(r[3]??"").replace(/\n/g,"/"), period: r[4], rental, comm });
  }
  if (comm) commSamples.push(comm);
  if (rental) rentalSamples.push(rental);
}
console.log(`고유 productCode: ${codes.size}개`);
console.log(`\n샘플 rentalPrice/commission:`);
for (const s of samples) {
  const rdiv = s.rental / 1.1;
  const cdiv = s.comm == null ? null : s.comm / 1.1;
  console.log(`  ${s.code} ${s.mode.slice(0,12)} ${s.period}m: 운영가 ${s.rental.toLocaleString()} (÷1.1=${rdiv.toFixed(2)}) / 수수료 ${s.comm?.toLocaleString() ?? "-"} (÷1.1=${cdiv?.toFixed(2) ?? "-"})`);
}

console.log(`\n수수료 합계 통계: ${commSamples.length}건, min=${Math.min(...commSamples).toLocaleString()}, max=${Math.max(...commSamples).toLocaleString()}`);
console.log(`운영가 통계: ${rentalSamples.length}건, min=${Math.min(...rentalSamples).toLocaleString()}, max=${Math.max(...rentalSamples).toLocaleString()}`);

// 끝 자리 분포 (VAT 포함 패턴 확인)
const last3comm = {};
const last3rental = {};
for (const c of commSamples) {
  const k = String(c % 1000).padStart(3, "0");
  last3comm[k] = (last3comm[k] ?? 0) + 1;
}
for (const c of rentalSamples) {
  const k = String(c % 1000).padStart(3, "0");
  last3rental[k] = (last3rental[k] ?? 0) + 1;
}
console.log("\n수수료합계 끝3자리 (top 10):");
for (const [k, v] of Object.entries(last3comm).sort((a, b) => b[1] - a[1]).slice(0, 10))
  console.log(`  ${k}: ${v}건`);
console.log("\n운영가 끝3자리 (top 10):");
for (const [k, v] of Object.entries(last3rental).sort((a, b) => b[1] - a[1]).slice(0, 10))
  console.log(`  ${k}: ${v}건`);
