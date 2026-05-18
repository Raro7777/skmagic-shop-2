/**
 * 새 정책표 (수정v4, 복호화 미포함) vs 기존 import 자료 (DB) 비교.
 * 핵심: WPUMAC306SWH / WPUIAC425SNS·SNW / WPUJAC125SVB 4종 방문/셀프 60m 검증.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const NEW_FILE = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정v4.xlsx";
const TARGETS = ["WPUMAC306SWH", "WPUIAC425SNS", "WPUIAC425SNW", "WPUJAC125SVB"];

type Row = {
  code: string;
  mode: "방문형" | "셀프형" | null;
  cp: number;
  base: number | null;       // col 7 기준가
  operational: number | null; // col 8 운영가
  promo: number | null;       // col 9 판촉가
  baseSalesCommission: number | null; // col 10 기본판매수수료
  promoSalesCommission: number | null; // col 11 5월전사판촉수수료
  incentiveCore: number | null;        // col 12 5월장려금 핵심모델
  incentiveStraight: number | null;    // col 13 직수주력
  incentiveIce: number | null;         // col 14 얼음주력
  commTotal: number | null;            // col 15 합계
};

function parseN(s: unknown): number | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || t === "-" || t.toUpperCase() === "X") return null;
  const cleaned = t.replace(/[, \s원]/g, "");
  const n = Number(cleaned);
  return isFinite(n) && n > 0 ? n : null;
}

function parseSheet(path: string): Row[] {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets["판매수수료_5월"];
  if (!sheet) { console.log(`시트 "판매수수료_5월" 없음 in ${path}`); return []; }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
  const out: Row[] = [];
  let lastCode = "";
  let lastMode: "방문형" | "셀프형" | null = null;
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeRaw = String(r[2] ?? "").trim();
    const code = codeRaw || lastCode;
    if (!code) continue;
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;
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

    const cp = Number(String(r[4] ?? "").replace(/[^0-9]/g, ""));
    if (!cp) continue;
    if (!TARGETS.includes(code)) continue;

    out.push({
      code, mode, cp,
      base: parseN(r[7]),
      operational: parseN(r[8]),
      promo: parseN(r[9]),
      baseSalesCommission: parseN(r[10]),
      promoSalesCommission: parseN(r[11]),
      incentiveCore: parseN(r[12]),
      incentiveStraight: parseN(r[13]),
      incentiveIce: parseN(r[14]),
      commTotal: parseN(r[15]),
    });
  }
  return out;
}

const fmt = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("ko-KR");

async function main() {
  console.log(`▶ 새 정책표 파싱: ${NEW_FILE.split("/").pop()}\n`);
  const sheetRows = parseSheet(NEW_FILE);
  console.log(`  타겟 4종 매칭 row: ${sheetRows.length}건 (방문형/셀프형 × 각 약정기간)\n`);

  // DB 데이터 fetch
  const dbProducts = await prisma.product.findMany({
    where: { productCode: { in: TARGETS } },
    select: {
      productCode: true, name: true,
      baseRentalPrice: true, rentalPrice: true, promoRentalPrice: true, cardDiscountPrice: true,
      hqPolicies: { select: { mode: true, contractPeriod: true, baseCommission: true, monthIncentive: true } },
      priceMatrix: true,
    },
  });

  for (const target of TARGETS) {
    const dbP = dbProducts.find(p => p.productCode === target);
    const sheetForTarget = sheetRows.filter(r => r.code === target);
    if (!dbP) { console.log(`[${target}] DB 미존재`); continue; }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`▶ ${target} — ${dbP.name}`);
    console.log(`  DB top-level : base=${fmt(dbP.baseRentalPrice)} rental=${fmt(dbP.rentalPrice)} promo=${fmt(dbP.promoRentalPrice)} card=${fmt(dbP.cardDiscountPrice)}`);
    console.log();

    for (const mode of ["방문형", "셀프형"]) {
      const sheetMode = sheetForTarget.filter(r => r.mode === mode).sort((a, b) => a.cp - b.cp);
      if (sheetMode.length === 0) continue;
      console.log(`  ${mode}:`);
      console.log(`    cp |   기준  |   운영  |   판촉  | base판매 | 전사판매 | 장려핵심 | 장려직수 | 장려얼음 |   합계   | DB.commission | 시트-DB`);
      for (const r of sheetMode) {
        const hq = dbP.hqPolicies.find(h => h.mode === r.mode && h.contractPeriod === r.cp);
        const dbBaseTotal = (hq?.baseCommission ?? 0) + (hq?.monthIncentive ?? 0);
        const sheetTotal = r.commTotal ?? 0;
        const delta = sheetTotal - dbBaseTotal;
        const flag = Math.abs(delta) > 100 ? " ⚠" : "";
        console.log(
          `    ${String(r.cp).padStart(2)} | ` +
          `${fmt(r.base).padStart(7)} | ${fmt(r.operational).padStart(7)} | ${fmt(r.promo).padStart(7)} | ` +
          `${fmt(r.baseSalesCommission).padStart(8)} | ${fmt(r.promoSalesCommission).padStart(8)} | ` +
          `${fmt(r.incentiveCore).padStart(8)} | ${fmt(r.incentiveStraight).padStart(8)} | ${fmt(r.incentiveIce).padStart(8)} | ` +
          `${fmt(r.commTotal).padStart(8)} | ${fmt(dbBaseTotal).padStart(13)} | ${(delta >= 0 ? "+" : "") + fmt(delta)}${flag}`,
        );
      }
      console.log();
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
