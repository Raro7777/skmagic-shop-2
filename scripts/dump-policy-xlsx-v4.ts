/**
 * SK매직 5월 정책서 v4 (복호화본) 의 시트/컬럼 구조 덤프.
 * 신규 import 스크립트 작성용 사전 분석.
 */
import * as XLSX from "xlsx";

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정_v4_복호화(1).xlsx";

function main() {
  const wb = XLSX.readFile(PATH);
  console.log(`📊 시트 목록 (${wb.SheetNames.length}개):`);
  for (const name of wb.SheetNames) {
    console.log(`  - ${name}`);
  }
  console.log();

  // 첫 시트 헤더 + 첫 10 행 덤프
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
    console.log(`══════ 시트: ${sheetName} (${rows.length} rows) ══════`);
    const limit = sheetName === "판매수수료_5월" ? Math.min(rows.length, 35) : Math.min(rows.length, 12);
    for (let i = 0; i < limit; i++) {
      const r = rows[i] ?? [];
      const cols = r.map((c, idx) => {
        const v = c == null ? "" : String(c).replace(/\n/g, "↵").slice(0, 24);
        return `[${idx}]${v}`;
      });
      console.log(`R${String(i).padStart(3)}: ${cols.join(" | ")}`);
    }
    console.log();
  }
}

main();
