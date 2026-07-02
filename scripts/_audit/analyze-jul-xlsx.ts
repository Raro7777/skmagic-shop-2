import * as XLSX from "xlsx";
const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_7월_제품_수수료표_0630_수정v12_1.xlsx";
const wb = XLSX.readFile(PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

console.log(`Total rows: ${rows.length}\n`);

// 참고사항 헤더 스킵 후 실제 데이터 행 찾기 — row 12 근처가 헤더 (다른 시트 참고)
console.log("=== Row 10~14 (헤더 후보) ===");
for (let i = 10; i < 15; i++) {
  const r = rows[i] as unknown[];
  console.log(`[r${i+1}] ` + r.slice(0, 20).map(v => JSON.stringify(v)).join(" "));
}

// 상품별 카테고리 카운트
const codeSet = new Set<string>();
const prefixCount = new Map<string, number>();
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] as unknown[];
  const code = String(r[2] ?? "").trim(); // productCode 컬럼
  if (/^WPU[A-Z]{3}\d/.test(code)) {
    codeSet.add(code);
    const prefix = code.slice(0, 9);
    prefixCount.set(prefix, (prefixCount.get(prefix) ?? 0) + 1);
  }
}
console.log(`\n=== 발견된 productCode 총 ${codeSet.size}종 ===`);
console.log(`\n=== prefix 별 옵션 개수 ===`);
for (const [prefix, cnt] of [...prefixCount.entries()].sort((a,b) => b[1] - a[1])) {
  console.log(`  ${prefix}  ${cnt}개 옵션`);
}
