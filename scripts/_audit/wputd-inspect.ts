import * as XLSX from "xlsx";
const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_7월_제품_수수료표_0630_수정v12_1.xlsx";
const wb = XLSX.readFile(PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

// WPUTD로 시작하는 상품들의 카테고리/색상 파악
console.log("=== WPUTDx 계열 (신규 prefix) 상세 ===");
let lastCategory = "";
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] as unknown[];
  const category = String(r[0] ?? "").trim();
  const modelName = String(r[1] ?? "").trim();
  const code = String(r[2] ?? "").trim();
  const color = String(r[3] ?? "").trim();
  if (category) lastCategory = category;
  if (code.startsWith("WPUTD")) {
    console.log(`[r${i+1}] [${lastCategory}] ${modelName} ${code} — ${color.slice(0, 30)}`);
  }
}

// 6월과 비교 위해 6월 대비 신규 productCode 존재하는지 확인
const julyCodes = new Set<string>();
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] as unknown[];
  const code = String(r[2] ?? "").trim();
  if (/^WPU[A-Z]{3}\d/.test(code)) julyCodes.add(code);
}
console.log(`\n=== 7월 xlsx 총 productCode 수: ${julyCodes.size} ===`);

// 초소형 플러스 가격 (6월 대비 -1000원 인하 반영 확인)
console.log(`\n=== 초소형 플러스 (WPUJAC115) 가격 샘플 ===`);
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] as unknown[];
  const code = String(r[2] ?? "").trim();
  if (code.startsWith("WPUJAC115")) {
    console.log(`[r${i+1}] ${code} 의무=${r[4]} 소유=${r[5]} 관리=${r[6]}  기준가=${r[7]} 운영가=${r[8]} A할인가=${r[9]} 타사보상=${r[10]}`);
  }
}
