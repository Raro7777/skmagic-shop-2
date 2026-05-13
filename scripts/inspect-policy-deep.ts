import * as XLSX from "xlsx";

const path = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직 26년 4월 정책 (부가세 제외 , -0)_1.xlsx";
const wb = XLSX.readFile(path);

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  console.log(`\n===== [${name}] (${range.e.r + 1} rows × ${range.e.c + 1} cols) =====`);

  // Print headers + every cell, looking for keywords
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

  // Find rows mentioning 타사보상
  console.log(`\n>>> "타사" 또는 "보상" 포함 행:`);
  rows.forEach((r, i) => {
    const text = r.map(c => (c == null ? "" : String(c))).join(" | ");
    if (/타사|보상/.test(text)) {
      console.log(`  R${i + 1}: ${text.slice(0, 300)}`);
    }
  });

  // Print all column headers (first 4 rows usually contain merged headers)
  console.log(`\n>>> 헤더 영역 (R1-R4):`);
  for (let i = 0; i < Math.min(4, rows.length); i++) {
    const cells = (rows[i] ?? []).map(c => (c == null ? "" : String(c).slice(0, 40)));
    console.log(`  R${String(i + 1).padStart(2, "0")}: ${cells.map((c, idx) => `[${idx}]${c}`).join("  ")}`);
  }

  // Sample mid + bottom rows
  console.log(`\n>>> 중간 영역 (R150-R155):`);
  for (let i = 149; i < Math.min(155, rows.length); i++) {
    const cells = (rows[i] ?? []).map(c => (c == null ? "" : String(c).slice(0, 50)));
    console.log(`  R${String(i + 1).padStart(3, "0")}: ${cells.join(" | ")}`);
  }

  console.log(`\n>>> 하단 (R${rows.length - 5} ~ R${rows.length}):`);
  for (let i = Math.max(0, rows.length - 6); i < rows.length; i++) {
    const cells = (rows[i] ?? []).map(c => (c == null ? "" : String(c).slice(0, 50)));
    console.log(`  R${String(i + 1).padStart(3, "0")}: ${cells.join(" | ")}`);
  }
}
