/**
 * 6월 정책의 26개 신규 productCode (DB 미존재) 의 source 추적.
 *
 * 각 코드별로 검사:
 *   - Product 에 status=discontinued / 다른 status 로 있나
 *   - CrawledProduct 에 있나
 *   - 5월 xlsx 에도 있는지 (apply-policy-may-2026 의 row dump 와 비교)
 *
 * 출력: 각 코드의 source 위치 + 자동 시드 가능성
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

function loadProductCodes(file: string, sheetName: string, codeColIdx: number) {
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  const codes = new Set<string>();
  for (let i = 12; i < rows.length; i++) {
    const code = rows[i][codeColIdx];
    if (typeof code === "string" && /^[A-Z0-9-]{8,}$/.test(code.trim())) {
      codes.add(code.trim());
    }
  }
  return codes;
}

async function main() {
  // 5월 정책 (sheet 가 "판매수수료_5월") — productCode 컬럼 인덱스 확인 필요. 5월/6월 동일 위치라고 가정 (보통 col[2] 또는 [4]).
  // 안전하게 양쪽 sheet 의 첫 데이터 row 를 dump 해서 확인.
  console.log("=== xlsx 시트 dump (첫 데이터 row) ===");
  const mayWb = xlsx.readFile(MAY);
  const juneWb = xlsx.readFile(JUNE);
  for (const [label, wb] of [["MAY", mayWb], ["JUNE", juneWb]] as const) {
    for (const sn of wb.SheetNames) {
      if (!sn.includes("판매수수료")) continue;
      const rows = xlsx.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, defval: null, blankrows: false });
      const r = rows[12] ?? [];
      console.log(`  [${label}/${sn}] row13:`, r.map((c, i) => `[${i}]${String(c ?? "").slice(0, 14)}`).slice(0, 10).join(" "));
    }
  }

  // productCode 컬럼은 col[2] (양쪽 동일)
  const mayCodes = loadProductCodes(MAY, "판매수수료_5월", 2);
  const juneCodes = loadProductCodes(JUNE, "판매수수료_6월", 2);
  console.log(`\n5월 productCode: ${mayCodes.size}개`);
  console.log(`6월 productCode: ${juneCodes.size}개`);

  // DB 의 Product
  const dbProducts = await prisma.product.findMany({
    select: { productCode: true, name: true, modelName: true, status: true, category: true },
  });
  const dbCodes = new Map(dbProducts.map(p => [p.productCode, p]));
  console.log(`DB Product: ${dbProducts.size}개 (active=${dbProducts.filter(p => p.status === "active").length}, discontinued=${dbProducts.filter(p => p.status === "discontinued").length})`);

  // CrawledProduct
  const crawled = await prisma.crawledProduct.findMany({
    select: { productCode: true, name: true, category: true, modelName: true, imageUrl: true, approvalStatus: true, changeType: true },
  });
  const crawledMap = new Map<string, typeof crawled[0]>();
  for (const c of crawled) if (c.productCode) crawledMap.set(c.productCode, c);
  console.log(`CrawledProduct: ${crawled.length}개 (with code: ${crawledMap.size})`);

  // 6월에만 있고 DB Product 에 없는 코드 추출
  const missing = [...juneCodes].filter(c => !dbCodes.has(c));
  console.log(`\n=== 6월 정책에 있으나 DB Product 에 없는 코드: ${missing.length}개 ===\n`);

  let inMay = 0, inMayOnly = 0, inCrawled = 0, inCrawledOnly = 0, nowhere = 0;

  for (const code of missing) {
    const inM = mayCodes.has(code);
    const c = crawledMap.get(code);
    const source: string[] = [];
    if (inM) source.push("5월 xlsx");
    if (c) {
      source.push(`CrawledProduct(${c.approvalStatus},${c.changeType})`);
      if (inM) inCrawled++;
      else inCrawledOnly++;
    } else if (inM) {
      inMayOnly++;
    } else {
      nowhere++;
    }
    if (inM) inMay++;

    const name = c?.name ?? "(이름 모름)";
    const cat = c?.category ?? "?";
    const img = c?.imageUrl ? "✓img" : "✗img";
    console.log(`  ${code}  ${source.join(" + ") || "❌ 어디에도 없음"}`);
    console.log(`     name="${name.slice(0, 50)}" cat=${cat} ${img}`);
  }

  console.log(`\n📊 source 요약:`);
  console.log(`   - 5월 xlsx 에 있던 코드: ${inMay}개`);
  console.log(`   - CrawledProduct 에 있음: ${inCrawled + inCrawledOnly}개 (자동 시드 가능 후보)`);
  console.log(`   - 5월 xlsx 만 있고 CrawledProduct 없음: ${inMayOnly}개 (수동 정보 필요)`);
  console.log(`   - 어디에도 없음: ${nowhere}개 (정책서 외 출처)`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
