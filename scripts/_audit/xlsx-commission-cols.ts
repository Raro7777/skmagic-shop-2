import * as XLSX from "xlsx";
const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_7월_제품_수수료표_0630_수정v12_1.xlsx";
const wb = XLSX.readFile(PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

// 헤더 3줄 완전 출력
console.log("=== 헤더 rows 11-12 (컬럼 정의) ===");
for (let ri of [10, 11]) {
  const r = rows[ri] as unknown[];
  for (let ci = 0; ci < 22; ci++) {
    console.log(`  [r${ri+1}][c${ci}] "${String(r[ci] ?? "").slice(0, 40).replace(/\n/g, " ")}"`);
  }
  console.log();
}

console.log("=== MEGA ICE (WPUIAC506) 60월 방문형 옵션 상세 값 ===");
for (let i = 12; i < 200; i++) {
  const r = rows[i] as unknown[];
  const code = String(r[2] ?? "").trim();
  const cm = String(r[3] ?? "").trim();
  const period = Number(r[4]);
  if (code.startsWith("WPUIAC506") && period === 60 && cm.includes("방문형")) {
    console.log(`[r${i+1}] ${code}`);
    for (let ci = 0; ci < 22; ci++) {
      console.log(`  c${ci}: ${String(r[ci] ?? "").slice(0, 40)}`);
    }
    break;
  }
}
