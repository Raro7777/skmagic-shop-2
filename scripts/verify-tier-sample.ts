import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import * as XLSX from "xlsx";

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정_v4_복호화(1).xlsx";

function main() {
  const target = process.argv[2] ?? "WPUJAC115SNW";
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets["판매수수료_5월"];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
  let lastCode = "";
  console.log(`▶ ${target} 시트 옵션:`);
  console.log(`  ${"mode".padEnd(8)} ${"cp".padStart(4)} ${"own".padStart(4)} ${"visit".padEnd(8)} ${"기준가".padStart(8)} ${"운영가".padStart(8)} ${"판촉가".padStart(8)} ${"수수료".padStart(10)}`);
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const code = (String(r[2] ?? "").trim() || lastCode);
    if (String(r[2] ?? "").trim()) lastCode = String(r[2]).trim();
    if (code !== target) continue;
    const variant = String(r[3] ?? "").trim().replace(/\n/g, " ");
    const cp = r[4], own = r[5], visit = r[6], base = r[7], rental = r[8], promo = r[9], comm = r[15];
    console.log(`  ${(variant.match(/방문|셀프/)?.[0] || "—").padEnd(8)} ${String(cp ?? "").padStart(4)} ${String(own ?? "").padStart(4)} ${String(visit ?? "").padEnd(8)} ${String(base ?? "—").padStart(8)} ${String(rental ?? "—").padStart(8)} ${String(promo ?? "—").padStart(8)} ${String(comm ?? "—").padStart(10)}`);
  }
}

main();
