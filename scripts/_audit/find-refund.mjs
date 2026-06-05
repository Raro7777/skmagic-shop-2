import xlsx from "xlsx";
const FILES = [
  "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx",
  "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정v4.xlsx",
  "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직 26년 4월 정책 (부가세 제외 , -0)_1.xlsx",
];
for (const file of FILES) {
  try {
    const wb = xlsx.readFile(file);
    console.log(`\n=== ${file.split("/").pop()} ===`);
    console.log(`시트: [${wb.SheetNames.join(", ")}]`);
    // 각 시트에서 "환수" / "환급" / "취소" / "해지" / "위약" 키워드 검색
    const KEYS = ["환수", "환급", "위약", "해지", "취소", "철회", "refund", "clawback"];
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
      const hits = [];
      for (let i = 0; i < rows.length; i++) {
        const line = rows[i].map(c => String(c ?? "")).join(" ");
        for (const k of KEYS) {
          if (line.includes(k)) { hits.push({ row: i + 1, k, line: line.slice(0, 100) }); break; }
        }
      }
      if (hits.length > 0) {
        console.log(`  [${sn}] ${hits.length}건`);
        for (const h of hits.slice(0, 5)) console.log(`    r${h.row} (${h.k}): ${h.line}`);
      }
    }
  } catch (e) { console.log(`${file}: ${e.message}`); }
}
