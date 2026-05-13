import * as XLSX from "xlsx";

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정_v4_복호화.xlsx";
const SHEET = "판매수수료_5월";
const DATA_START_ROW = 12;
const TARGET_CODES = new Set(["ACL15C1ASKWH", "ACL20C1ASKWH", "ACL25C1ASKCE"]);

const wb = XLSX.readFile(PATH);
const sheet = wb.Sheets[SHEET];
const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

let lastCode = "";
for (let i = DATA_START_ROW; i < rows.length; i++) {
  const r = rows[i] ?? [];
  const codeRaw = String(r[2] ?? "").trim();
  const code = codeRaw || lastCode;
  if (codeRaw) lastCode = codeRaw;
  if (!TARGET_CODES.has(code)) continue;

  const variantLabel = String(r[3] ?? "").trim().replace(/\n/g, " | ");
  const period = String(r[4] ?? "").trim();
  const ownership = String(r[5] ?? "").trim();
  const visit = String(r[6] ?? "").trim();
  const rent = String(r[8] ?? "").trim();
  const card = String(r[9] ?? "").trim();
  const base = String(r[15] ?? "").trim();
  const discont = `${r[17] ?? ""}${r[18] ?? ""}${r[19] ?? ""}`.trim();

  console.log(`[row ${i+1}] ${code} | "${variantLabel}" | 의무=${period} | 소유=${ownership} | 관리=${visit} | 운영가=${rent} | 판촉가=${card} | 수수료=${base}${discont ? ` | 비고=${discont}` : ""}`);
}
