/**
 * 본사 정책서 xlsx 의 col 7-15 모두 노출 — 어느 column 이 사용자의 "시트 60" 인지 확인.
 */
import * as XLSX from "xlsx";

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정_v4_복호화(1).xlsx";

const TARGETS = ["WPUMAC306SWH", "WPUIAC425SNS", "WPUIAC425SNW", "WPUJAC125SVB"];

function main() {
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets["판매수수료_5월"];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

  console.log("col 헤더 (R10-R11):");
  for (const r of [10, 11]) {
    const row = rows[r] ?? [];
    console.log(`  R${r}: ${row.map((c, i) => `[${i}]${String(c ?? "").replace(/\s+/g, " ").slice(0, 14)}`).join(" | ")}`);
  }

  console.log("\n매칭 row 추출 (방문형 60개월):");
  console.log("─".repeat(140));
  console.log(`code            mode  cp  | 기준(7) 운영(8) 판촉(9) | 기본판매수수료(10) | 전사판촉수수료(11) | 5월장려금(12) | 직수주력(13) | 얼음주력(14) | 합계(15)`);
  console.log("─".repeat(140));

  let lastCode = "";
  let lastMode: "방문형" | "셀프형" | null = null;
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeRaw = String(r[2] ?? "").trim();
    const code = codeRaw || lastCode;
    if (!code) continue;
    const isNewProduct = !!codeRaw && codeRaw !== lastCode;

    const variantRaw = String(r[3] ?? "").trim();
    const newMode: "방문형" | "셀프형" | null =
      variantRaw.includes("방문") ? "방문형" :
      variantRaw.includes("셀프") ? "셀프형" : null;
    let mode: "방문형" | "셀프형" | null;
    if (newMode) { mode = newMode; lastMode = newMode; }
    else if (isNewProduct) { mode = null; lastMode = null; }
    else mode = lastMode;
    if (codeRaw) lastCode = codeRaw;

    if (!TARGETS.includes(code)) continue;
    const cp = Number(String(r[4] ?? "").replace(/[^0-9]/g, ""));
    if (cp !== 60) continue;
    if (mode !== "방문형") continue;

    console.log(
      `${code.padEnd(15)} ${(mode ?? "—").padEnd(5)} ${String(cp).padStart(3)} | ` +
      [7, 8, 9, 10, 11, 12, 13, 14, 15].map(c => String(r[c] ?? "—").padStart(12)).join("  "),
    );
  }
  console.log("─".repeat(140));
}

main();
