/**
 * 6월 정책 적용 시 변동 내역 요약 (read-only).
 *
 *   1) 카테고리별 영향 받는 Product 개수
 *   2) 큰 가격 변동 top
 *   3) 큰 수수료 변동 top
 *   4) 신규 적용되는 타사보상
 *   5) 신규 출시 vs 기존 Product 시드 분리
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import xlsx from "xlsx";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const JUNE = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx";
const VAT = 1.1;

type JuneRow = {
  category: string;
  name: string;
  productCode: string;
  color: string;
  contractPeriod: number;
  visitInterval: string;
  rentalPriceVAT: number;     // col[7] 운영가
  promoPriceVAT: number | null; // col[8] 판촉가 (있을 때만)
  rivalCompPriceVAT: number | null; // col[10] 타사보상 가격
  baseCommissionVAT: number;  // col[16] 수수료 합계
  productLabel: string;       // "방문형" / "셀프형"
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseJune(): JuneRow[] {
  const wb = xlsx.readFile(JUNE);
  const ws = wb.Sheets["판매수수료_6월"];
  const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  const out: JuneRow[] = [];
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i];
    const code = typeof r[2] === "string" ? r[2].trim() : "";
    if (!code) continue;
    out.push({
      category: String(r[0] ?? "").trim() || "?",
      name: String(r[1] ?? "").trim(),
      productCode: code,
      color: String(r[3] ?? "").trim(),
      contractPeriod: Number(r[4]) || 0,
      visitInterval: String(r[6] ?? "").trim(),
      rentalPriceVAT: num(r[7]) ?? 0,
      promoPriceVAT: num(r[8]),
      rivalCompPriceVAT: num(r[10]),
      baseCommissionVAT: num(r[16]) ?? 0,
      productLabel: String(r[3] ?? "").includes("방문") ? "방문형" : String(r[3] ?? "").includes("셀프") ? "셀프형" : "?",
    });
  }
  return out;
}

async function main() {
  console.log("▶ 6월 정책 변동 내역 분석 (read-only)\n");

  const juneRows = parseJune();
  console.log(`6월 정책 row 수: ${juneRows.length}\n`);

  // 카테고리별 영향
  const byCat = new Map<string, { total: number; codes: Set<string> }>();
  for (const r of juneRows) {
    const cat = r.category || "기타";
    const e = byCat.get(cat) ?? { total: 0, codes: new Set() };
    e.total++;
    e.codes.add(r.productCode);
    byCat.set(cat, e);
  }
  console.log("=== [1] 카테고리별 row 분포 ===");
  for (const [cat, e] of [...byCat.entries()].sort((a,b) => b[1].total - a[1].total)) {
    console.log(`  ${cat.padEnd(12)} row ${e.total.toString().padStart(3)}건 · 고유 productCode ${e.codes.size}개`);
  }

  // 신규 vs 기존
  const dbProducts = await prisma.product.findMany({ select: { productCode: true, name: true, category: true } });
  const dbCodes = new Set(dbProducts.map(p => p.productCode));
  const juneCodes = new Set(juneRows.map(r => r.productCode));
  const newCodes = [...juneCodes].filter(c => !dbCodes.has(c));
  const removedCodes = [...dbCodes].filter(c => !juneCodes.has(c));
  console.log(`\n=== [2] 신규/단종 ===`);
  console.log(`  신규 (6월 에만, DB 미존재): ${newCodes.length}개`);
  console.log(`  단종 후보 (DB 에만, 6월 에 없음): ${removedCodes.length}개`);
  if (removedCodes.length > 0) {
    for (const c of removedCodes.slice(0, 10)) {
      const p = dbProducts.find(x => x.productCode === c);
      console.log(`     ⚠ ${c} ${p?.name?.slice(0, 30) ?? "?"} (${p?.category ?? "?"})`);
    }
  } else {
    console.log(`     ✅ 단종 없음 (기존 60개 모두 6월 정책 포함)`);
  }

  // HqPolicy 비교 — 수수료 변동
  console.log(`\n=== [3] 수수료 변동 top 10 (절대값 변화 큰 순) ===`);
  const hqPolicies = await prisma.hqPolicy.findMany({
    include: { product: { select: { productCode: true, name: true, category: true } } },
  });
  type Diff = { code: string; name: string; category: string; mode: string; period: number; before: number; after: number; delta: number; pct: number };
  const diffs: Diff[] = [];
  for (const r of juneRows) {
    const supply = Math.round(r.baseCommissionVAT / VAT); // VAT 제외
    const mode = r.color.includes("셀프") ? "self" : "visit";
    const existing = hqPolicies.find(p =>
      p.product.productCode === r.productCode &&
      p.contractPeriod === r.contractPeriod &&
      (p.mode === mode || p.mode === r.productLabel),
    );
    if (existing) {
      const before = existing.baseCommission;
      const after = supply;
      const delta = after - before;
      const pct = before > 0 ? (delta / before) * 100 : 0;
      if (Math.abs(delta) >= 10000) {
        diffs.push({
          code: r.productCode,
          name: r.name.slice(0, 25),
          category: existing.product.category,
          mode: mode === "self" ? "셀프" : "방문",
          period: r.contractPeriod,
          before, after, delta, pct,
        });
      }
    }
  }
  diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  for (const d of diffs.slice(0, 10)) {
    const sign = d.delta > 0 ? "+" : "";
    console.log(`  ${d.code.padEnd(13)} ${d.mode}${d.period}m  ${d.before.toLocaleString().padStart(8)} → ${d.after.toLocaleString().padStart(8)}  ${sign}${d.delta.toLocaleString().padStart(7)}원 (${d.pct.toFixed(1)}%)  ${d.category} "${d.name}"`);
  }
  console.log(`\n  📊 변동 합계: ${diffs.length}건 (≥10,000원 변동만 카운트)`);
  const up = diffs.filter(d => d.delta > 0).length;
  const down = diffs.filter(d => d.delta < 0).length;
  console.log(`     인상 ${up}건 / 인하 ${down}건`);

  // 타사보상 적용
  console.log(`\n=== [4] 타사보상 신규 적용 ===`);
  const rivalCount = juneRows.filter(r => r.rivalCompPriceVAT && r.rivalCompPriceVAT > 0).length;
  console.log(`  6월 xlsx 에 타사보상 가격 명시된 row: ${rivalCount}건`);

  // 카테고리별 수수료 변동 합계
  console.log(`\n=== [5] 카테고리별 영향 요약 ===`);
  const catImpact = new Map<string, { up: number; down: number; same: number; codes: Set<string> }>();
  for (const d of diffs) {
    const e = catImpact.get(d.category) ?? { up: 0, down: 0, same: 0, codes: new Set() };
    if (d.delta > 0) e.up++; else if (d.delta < 0) e.down++; else e.same++;
    e.codes.add(d.code);
    catImpact.set(d.category, e);
  }
  for (const [cat, e] of catImpact) {
    console.log(`  ${cat.padEnd(12)} 인상 ${e.up} · 인하 ${e.down}  (${e.codes.size}개 코드)`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
