/**
 * MEGA ICE 정수기 (WPUIAC506SNS/SNW) 의 6월 정책 60m/72m 수수료 변동 검증.
 *
 * 1차 분석에서 +42%/+53% 점프 (얼음주력모델 장려금 150K 신설) 라고 했는데,
 * 실제 xlsx row 와 현재 DB HqPolicy 를 비교해 진짜 본사 정책 데이터인지 확인.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import xlsx from "xlsx";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const JUNE = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx";
const MAY = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정v4.xlsx";
const VAT = 1.1;
const TARGET_CODES = ["WPUIAC506SNS", "WPUIAC506SNW"]; // MEGA ICE 두 컬러

function dumpRows(file: string, sheetName: string) {
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  const out: Array<{ row: number; code: string; mode: string; period: number; visitInterval: string;
                     rentalPriceVAT: number; commissionVAT: number; supplyComm: number }> = [];
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i];
    const code = typeof r[2] === "string" ? r[2].trim() : "";
    if (!TARGET_CODES.includes(code)) continue;
    const mode = String(r[3] ?? "").includes("셀프") ? "self" : String(r[3] ?? "").includes("방문") ? "visit" : "?";
    const period = Number(r[4]) || 0;
    const visitInterval = String(r[6] ?? "").trim();
    const rentalPriceVAT = Number(String(r[7] ?? "0").replace(/,/g, "")) || 0;
    // 5월 컬럼 index = 15, 6월 = 16
    const commColIdx = sheetName.includes("6월") ? 16 : 15;
    const commissionVAT = Number(String(r[commColIdx] ?? "0").replace(/,/g, "")) || 0;
    out.push({
      row: i + 1, code, mode, period, visitInterval,
      rentalPriceVAT, commissionVAT,
      supplyComm: Math.round(commissionVAT / VAT),
    });
  }
  return out;
}

async function main() {
  console.log("=== MEGA ICE 정수기 (WPUIAC506) 5월 vs 6월 수수료 비교 ===\n");

  const may = dumpRows(MAY, "판매수수료_5월");
  const june = dumpRows(JUNE, "판매수수료_6월");

  console.log(`5월 row: ${may.length}, 6월 row: ${june.length}\n`);

  // 매칭: code + mode + period
  const key = (r: { code: string; mode: string; period: number }) => `${r.code}|${r.mode}|${r.period}m`;
  const mayMap = new Map(may.map(r => [key(r), r]));
  const allKeys = [...new Set([...mayMap.keys(), ...june.map(key)])].sort();

  console.log(`${"code".padEnd(13)} ${"mode".padEnd(6)} ${"period".padEnd(7)} ${"방문주기".padEnd(8)} | 5월 공급가 | 6월 공급가 |    Δ    | %`);
  console.log("-".repeat(110));

  let upTotal = 0, downTotal = 0;
  for (const k of allKeys) {
    const m = mayMap.get(k);
    const j = june.find(r => key(r) === k);
    if (!m && !j) continue;
    const mSupply = m?.supplyComm ?? 0;
    const jSupply = j?.supplyComm ?? 0;
    const delta = jSupply - mSupply;
    const pct = mSupply > 0 ? (delta / mSupply) * 100 : 0;
    const interval = j?.visitInterval ?? m?.visitInterval ?? "—";
    const code = j?.code ?? m?.code ?? "?";
    const mode = j?.mode ?? m?.mode ?? "?";
    const period = j?.period ?? m?.period ?? 0;
    const flag = Math.abs(delta) > 50000 ? "★" : Math.abs(delta) > 10000 ? "•" : " ";
    console.log(
      `${code.padEnd(13)} ${mode.padEnd(6)} ${(period + "m").padEnd(7)} ${interval.padEnd(8)} | ${mSupply.toLocaleString().padStart(9)} | ${jSupply.toLocaleString().padStart(9)} | ${(delta >= 0 ? "+" : "") + delta.toLocaleString().padStart(7)} | ${pct.toFixed(1).padStart(5)}% ${flag}`,
    );
    if (delta > 0) upTotal++;
    else if (delta < 0) downTotal++;
  }
  console.log(`\n📊 인상 ${upTotal}건 / 인하 ${downTotal}건`);

  // DB HqPolicy 현재 값 (운영 중인 값)
  const products = await prisma.product.findMany({
    where: { productCode: { in: TARGET_CODES } },
    select: { id: true, productCode: true },
  });
  const ids = products.map(p => p.id);
  const policies = await prisma.hqPolicy.findMany({
    where: { productId: { in: ids } },
    include: { product: { select: { productCode: true } } },
    orderBy: [{ product: { productCode: "asc" } }, { mode: "asc" }, { contractPeriod: "asc" }],
  });
  console.log(`\n=== 현재 DB HqPolicy (운영 중) ===`);
  for (const p of policies) {
    console.log(`  ${p.product.productCode} ${p.mode}${p.contractPeriod}m  base=${p.baseCommission.toLocaleString()} incentive=${p.monthIncentive.toLocaleString()}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
