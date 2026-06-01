/**
 * 26개 신규 productCode 의 자료 source 심층 검색.
 *   - HqPolicy 테이블
 *   - CrawledProduct 의 modelName/name 부분매칭 (productCode 미매핑된 367-60=307개)
 *   - 6월 xlsx 의 컨텍스트 컬럼 (category/name/modelName/색상 등)
 *   - 5월 xlsx 의 동일 정보
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

const TARGETS = [
  "WPUGBC102SWW", "WPUIAC606SSB", "ACL300VASKWH", "ACL16C2ASKZG", "ACL22C2ASKZG",
  "MATSD011RFBR", "MATQD011RFBR", "MATKD011RFBR", "MATSH511RFBR", "MATQH511RFBR",
  "MATKH511RFBR", "MATQM430RLWH", "MATKM430RLWH", "MATQM730RZOM", "MATQH651RZWD",
  "MATQM230RSBR", "MATKM230RSBR", "MATQH510RKWH", "MATQF520RKIV", "MATQF530RKBE",
  "MATKF520RKIV", "MATKF530RKBE", "MATQH520RKIV", "MATQH530RKBE", "MATKH520RKIV",
  "MATKH530RKBE",
];

type XlsxRow = { category: string; name: string; productCode: string; color: string; row: number };

function dumpRowsForCodes(file: string, sheetName: string, codes: Set<string>): Map<string, XlsxRow> {
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  const result = new Map<string, XlsxRow>();
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i];
    const code = typeof r[2] === "string" ? r[2].trim() : "";
    if (!codes.has(code) || result.has(code)) continue;
    result.set(code, {
      row: i,
      category: String(r[0] ?? "").trim(),
      name: String(r[1] ?? "").trim(),
      productCode: code,
      color: String(r[3] ?? "").trim(),
    });
  }
  return result;
}

async function main() {
  const targetSet = new Set(TARGETS);

  // 6월 + 5월 xlsx 에서 26개 코드의 컨텍스트 정보 추출
  const fromJune = dumpRowsForCodes(JUNE, "판매수수료_6월", targetSet);
  const fromMay = dumpRowsForCodes(MAY, "판매수수료_5월", targetSet);
  console.log(`6월 xlsx 에서 발견: ${fromJune.size}/26`);
  console.log(`5월 xlsx 에서 발견: ${fromMay.size}/26`);

  // HqPolicy 는 Product FK 라 Product 없으면 자동으로 없음 — skip
  const inHqPolicy = new Set<string>();

  // CrawledProduct — productCode 없는 것도 포함, name 부분매칭
  const allCrawled = await prisma.crawledProduct.findMany({
    select: { id: true, productCode: true, name: true, modelName: true, category: true, imageUrl: true },
  });

  console.log(`\n=== 26개 코드별 source 매트릭스 ===\n`);
  for (const code of TARGETS) {
    const j = fromJune.get(code);
    const m = fromMay.get(code);
    const hq = inHqPolicy.has(code);

    // CrawledProduct 의 productCode 정확 매칭
    const exactCrawl = allCrawled.find(c => c.productCode === code);
    // productCode 없는 항목 중 name/modelName 에 partial 매칭 (예: ACL16C2 → "ACL16C2" 또는 "AC16C")
    const codeShort = code.slice(0, 8);
    const partialCrawls = allCrawled.filter(c => !c.productCode && (
      (c.modelName && c.modelName.includes(codeShort)) ||
      (c.name && c.name.includes(codeShort))
    ));

    const ctx = j ?? m;
    const cat = ctx?.category ?? "?";
    const name = ctx?.name ?? "?";
    const color = ctx?.color ?? "";

    console.log(`${code}  cat=${cat.padEnd(8)} name=${name.slice(0, 30).padEnd(30)} color=${color.padEnd(8)}`);
    console.log(`   sources: ${j ? "6월xlsx " : ""}${m ? "5월xlsx " : ""}${hq ? "HqPolicy " : ""}${exactCrawl ? "crawled-exact " : ""}${partialCrawls.length > 0 ? `crawled-partial(${partialCrawls.length}) ` : ""}`);
    if (exactCrawl?.imageUrl) console.log(`   img: ${exactCrawl.imageUrl.slice(0, 60)}`);
    if (partialCrawls.length > 0 && partialCrawls.length <= 3) {
      for (const pc of partialCrawls) {
        console.log(`   partial: id=${pc.id.slice(0, 8)} name="${(pc.name ?? "").slice(0, 40)}" model=${pc.modelName ?? "—"}`);
      }
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
