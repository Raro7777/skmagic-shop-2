// Diff productCodes May v4 vs June v2
import xlsx from "xlsx";
function load(path, sheet) {
  const wb = xlsx.readFile(path);
  return xlsx.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null, raw: false });
}

function parseNum(s) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || t === "-" || t.toUpperCase() === "X") return null;
  const n = Number(t.replace(/[, \s원]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function detectMode(label) {
  if (/방문/.test(label)) return "방문형";
  if (/셀프|자가|Lite/i.test(label)) return "셀프형";
  return null;
}

function parseSheet(rows, opts) {
  const { commCol, discontCols } = opts;
  const out = new Map();  // productCode -> options[]
  const lastModeForCode = {};
  let lastCode = "";
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeRaw = String(r[2] ?? "").trim();
    const code = codeRaw || lastCode;
    if (codeRaw) {
      lastCode = codeRaw;
      if (!(code in lastModeForCode)) lastModeForCode[code] = null;
    }
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;

    const variantLabel = String(r[3] ?? "").trim();
    const detected = detectMode(variantLabel);
    if (detected) lastModeForCode[code] = detected;
    const mode = detected ?? lastModeForCode[code] ?? null;

    const period = parseNum(String(r[4] ?? ""));
    if (!period) continue;

    const rental = parseNum(String(r[8] ?? ""));
    const promo = parseNum(String(r[9] ?? ""));
    const comm = parseNum(String(r[commCol] ?? ""));
    const discontText = discontCols.map(c => r[c] ?? "").join("");
    const discontinued = /단종|운영중지|미운영/.test(discontText) || (/운영종료/.test(discontText) && !/통합운영/.test(discontText));

    if (!out.has(code)) out.set(code, []);
    out.get(code).push({ mode, period, rental, promo, comm, discontinued, variantLabel });
  }
  return out;
}

const MAY = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정v4.xlsx";
const JUN = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx";

const may = parseSheet(load(MAY, "판매수수료_5월"), { commCol: 15, discontCols: [17, 18, 19] });
const jun = parseSheet(load(JUN, "판매수수료_6월"), { commCol: 16, discontCols: [19, 20] });

const mayCodes = new Set(may.keys());
const junCodes = new Set(jun.keys());
const onlyMay = [...mayCodes].filter(c => !junCodes.has(c)).sort();
const onlyJun = [...junCodes].filter(c => !mayCodes.has(c)).sort();
const both = [...mayCodes].filter(c => junCodes.has(c)).sort();

console.log(`5월 productCodes: ${mayCodes.size}개`);
console.log(`6월 productCodes: ${junCodes.size}개`);
console.log(`교집합: ${both.length}개`);
console.log(`\n5월 only (6월에 없음, 단종 의심): ${onlyMay.length}개`);
for (const c of onlyMay) console.log(`  - ${c}`);
console.log(`\n6월 only (신규 추가): ${onlyJun.length}개`);
for (const c of onlyJun) console.log(`  - ${c}`);

// 가격/수수료 변동 — 공통 코드에서 (mode, period) 매칭하여 비교
console.log(`\n=== 가격/수수료 변동 (mode×period 매칭) ===`);
let rentalChanged = 0, commChanged = 0, promoChanged = 0;
const rentalDiffs = [], commDiffs = [], promoDiffs = [];
for (const code of both) {
  const mayOpts = may.get(code);
  const junOpts = jun.get(code);
  for (const j of junOpts) {
    const m = mayOpts.find(x => x.mode === j.mode && x.period === j.period);
    if (!m) continue;
    if (m.rental !== j.rental) {
      rentalChanged++;
      if (rentalDiffs.length < 10) rentalDiffs.push(`${code} ${j.mode ?? "단일"} ${j.period}m: 운영가 ${m.rental?.toLocaleString() ?? "-"} → ${j.rental?.toLocaleString() ?? "-"}`);
    }
    if (m.comm !== j.comm) {
      commChanged++;
      if (commDiffs.length < 10) commDiffs.push(`${code} ${j.mode ?? "단일"} ${j.period}m: 수수료 ${m.comm?.toLocaleString() ?? "-"} → ${j.comm?.toLocaleString() ?? "-"}`);
    }
    if (m.promo !== j.promo) {
      promoChanged++;
      if (promoDiffs.length < 10) promoDiffs.push(`${code} ${j.mode ?? "단일"} ${j.period}m: 판촉가 ${m.promo?.toLocaleString() ?? "-"} → ${j.promo?.toLocaleString() ?? "-"}`);
    }
  }
}
console.log(`운영가 변동: ${rentalChanged}건`);
for (const d of rentalDiffs) console.log(`  ${d}`);
console.log(`\n수수료 변동: ${commChanged}건`);
for (const d of commDiffs) console.log(`  ${d}`);
console.log(`\n판촉가 변동: ${promoChanged}건`);
for (const d of promoDiffs) console.log(`  ${d}`);
