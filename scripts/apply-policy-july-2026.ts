/**
 * SK매직 26년 7월 정책 통합 적용 스크립트.
 *
 * 1) 신규 상품 7종 등록 (뉴슬림플러스 5종 + 초소형 플러스 D-prefix 2종) — 크롤 결과 활용
 * 2) 기존 상품의 priceMatrix / rentalPrice / promoRentalPrice / baseRentalPrice 업데이트
 * 3) 카드할인 반영 — cardDiscountPrice = promoRentalPrice - 27,000 (롯데 LOCA 최대 기준)
 *    음수면 0 (카드할인 = 무료 표기)
 *
 * 데이터 원본:
 *   - xlsx: /Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_7월_제품_수수료표_0630_수정v12_1.xlsx
 *   - 이미지: SK매직 공식몰 크롤 (skmagic.com) — imageUrl / imageUrls 자동 매핑
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { skmagicAdapter } from "@/lib/crawler/skmagic";

const XLSX_PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_7월_제품_수수료표_0630_수정v12_1.xlsx";
const CARD_DISCOUNT_MAX = 27000; // 롯데 LOCA 최대 (25,000 + 2,000 60개월 추가)

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

type XlsxRow = {
  category: string;
  modelName: string;
  productCode: string;
  colorMode: string;      // "* 방문형 *\n화이트" 등
  obligation: number;     // 의무기간(월)
  ownership: number;      // 소유권기간
  managementCycle: string;
  basePrice: number;
  operatingPrice: number;
  julyPromoPrice: number;
  rivalPrice: number;
  baseCommission: number;
  julyCommission: number;
};

function parseColorMode(cm: string): { mode: "방문형" | "셀프형" | null; color: string } {
  const parts = cm.split("\n").map(s => s.trim()).filter(Boolean);
  let mode: "방문형" | "셀프형" | null = null;
  const colorParts: string[] = [];
  for (const p of parts) {
    if (p.includes("방문형")) mode = "방문형";
    else if (p.includes("셀프형")) mode = "셀프형";
    else colorParts.push(p);
  }
  return { mode, color: colorParts.join(" ") };
}

function loadXlsx(): XlsxRow[] {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  const out: XlsxRow[] = [];
  let currentCategory = "";
  let currentModelName = "";
  let currentColorMode = "";
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const cat = String(r[0] ?? "").trim();
    const mn = String(r[1] ?? "").trim();
    const code = String(r[2] ?? "").trim();
    const cm = String(r[3] ?? "").trim();
    if (cat) currentCategory = cat;
    if (mn) currentModelName = mn.split("\n")[0].trim();
    if (cm) currentColorMode = cm;
    if (!/^WPU[A-Z]{3}\d/.test(code)) continue;
    out.push({
      category: currentCategory,
      modelName: currentModelName,
      productCode: code,
      colorMode: currentColorMode,
      obligation: Number(r[4]) || 0,
      ownership: Number(r[5]) || 0,
      managementCycle: String(r[6] ?? "").trim(),
      basePrice: Number(r[7]) || 0,
      operatingPrice: Number(r[8]) || 0,
      julyPromoPrice: Number(r[9]) || 0,
      rivalPrice: Number(r[10]) || 0,
      baseCommission: Number(r[11]) || 0,
      julyCommission: Number(r[12]) || 0,
    });
  }
  return out;
}

type PriceOpt = {
  mode: "방문형" | "셀프형" | null;
  contractPeriod: number;
  ownershipPeriod?: number;
  visitInterval?: string;
  variantLabel?: string;
  rentalPrice?: number | null;
  cardDiscountPrice?: number | null;
  baseCommission?: number | null;
  rivalCompensationPrice?: number | null;
  rivalCompensationHalfPriceMonths?: number | null;
  baseRentalPrice?: number | null;
  promoRentalPrice?: number | null;
};

function buildPriceMatrix(rows: XlsxRow[]): PriceOpt[] {
  return rows.map(r => {
    const { mode, color } = parseColorMode(r.colorMode);
    const promo = r.julyPromoPrice > 0 ? r.julyPromoPrice : null;
    const operating = r.operatingPrice > 0 ? r.operatingPrice : null;
    const cardEffective = promo != null
      ? Math.max(0, promo - CARD_DISCOUNT_MAX)
      : operating != null ? Math.max(0, operating - CARD_DISCOUNT_MAX) : null;
    return {
      mode,
      contractPeriod: r.obligation,
      ownershipPeriod: r.ownership,
      visitInterval: r.managementCycle || undefined,
      variantLabel: color || undefined,
      rentalPrice: operating,
      promoRentalPrice: promo,
      baseRentalPrice: r.basePrice > 0 ? r.basePrice : null,
      cardDiscountPrice: cardEffective,
      baseCommission: r.baseCommission > 0 ? r.baseCommission : null,
      rivalCompensationPrice: r.rivalPrice > 0 ? r.rivalPrice : null,
    };
  });
}

// 상품별 대표 옵션 (60개월 방문형 우선 → 60개월 아무거나 → 첫 옵션)
function pickRepresentative(matrix: PriceOpt[]): PriceOpt {
  return (
    matrix.find(o => o.contractPeriod === 60 && o.mode === "방문형") ??
    matrix.find(o => o.contractPeriod === 60) ??
    matrix[0]
  );
}

function inferCategoryFromCode(code: string): string {
  if (code.startsWith("WPU")) return "water";
  if (code.startsWith("ACL") || code.startsWith("APU")) return "air";
  if (code.startsWith("BID") || code.startsWith("BIS")) return "bidet";
  return "water";
}

async function main() {
  console.log("→ 7월 xlsx 로드…");
  const xlsxRows = loadXlsx();
  console.log(`  총 ${xlsxRows.length}개 옵션 파싱됨\n`);

  const uniqueCodes = [...new Set(xlsxRows.map(r => r.productCode))];
  console.log(`  productCode ${uniqueCodes.length}종`);

  console.log("\n→ SK매직 크롤 (신규 상품 이미지·상세 정보용)…");
  const crawlRes = await skmagicAdapter.fetch();
  const crawlByCode = new Map(crawlRes.items.map(p => [p.productCode, p]));
  console.log(`  크롤 결과 ${crawlRes.items.length}개  warnings=${crawlRes.warnings?.length ?? 0}`);

  // DB 상품 로드
  const dbProds = await prisma.product.findMany({
    select: { id: true, productCode: true, status: true, name: true },
  });
  const dbByCode = new Map(dbProds.map(p => [p.productCode, p]));

  // 신규 vs 기존 분류
  const newCodes = uniqueCodes.filter(c => !dbByCode.has(c));
  const existingCodes = uniqueCodes.filter(c => dbByCode.has(c));

  console.log(`\n  🆕 신규 등록 대상: ${newCodes.length}종`);
  for (const c of newCodes) console.log(`    ${c}`);
  console.log(`  📝 기존 업데이트: ${existingCodes.length}종`);

  // ============ 1) 신규 상품 등록 ============
  console.log("\n=== 신규 상품 7종 등록 ===");
  for (const code of newCodes) {
    const rows = xlsxRows.filter(r => r.productCode === code);
    if (rows.length === 0) continue;
    const matrix = buildPriceMatrix(rows);
    const rep = pickRepresentative(matrix);
    const crawl = crawlByCode.get(code);

    if (!crawl) {
      console.log(`  ⚠️ ${code} — 크롤 결과에 없음, 이미지 없이 등록`);
    }

    const name = crawl?.name ?? rows[0].modelName;
    const category = crawl?.category ?? inferCategoryFromCode(code);
    const managementType = rep.mode === "셀프형" ? "자가관리형" : "방문관리형";

    await prisma.product.create({
      data: {
        productCode: code,
        modelName: code,
        name,
        category,
        status: "active",
        rentalPrice: rep.rentalPrice ?? 0,
        promoRentalPrice: rep.promoRentalPrice,
        baseRentalPrice: rep.baseRentalPrice,
        cardDiscountPrice: rep.cardDiscountPrice,
        contractPeriod: rep.contractPeriod || 60,
        managementType,
        imageUrl: crawl?.imageUrl ?? null,
        imageUrls: crawl?.imageUrls ?? [],
        description: crawl?.description ?? null,
        priceMatrix: matrix as unknown as never,
        keyFeatures: (crawl?.keyFeatures ?? []) as unknown as never,
        specs: (crawl?.specs ?? {}) as unknown as never,
        warrantyMonths: crawl?.warrantyMonths ?? null,
        isFeatured: false,
      },
    });
    console.log(`  ✅ 등록: ${code}  ${name}  (${matrix.length} 옵션)`);
  }

  // ============ 2) 기존 상품 업데이트 ============
  console.log("\n=== 기존 상품 가격 업데이트 ===");
  let updated = 0;
  for (const code of existingCodes) {
    const rows = xlsxRows.filter(r => r.productCode === code);
    const matrix = buildPriceMatrix(rows);
    const rep = pickRepresentative(matrix);
    await prisma.product.update({
      where: { productCode: code },
      data: {
        priceMatrix: matrix as unknown as never,
        rentalPrice: rep.rentalPrice ?? undefined,
        promoRentalPrice: rep.promoRentalPrice,
        baseRentalPrice: rep.baseRentalPrice,
        cardDiscountPrice: rep.cardDiscountPrice,
      },
    });
    updated++;
  }
  console.log(`  📝 ${updated}종 업데이트 완료`);

  console.log("\n=== ✅ 완료 ===");
  console.log(`  신규 등록: ${newCodes.length}종`);
  console.log(`  기존 업데이트: ${updated}종`);
  console.log(`  카드할인 기준: 롯데 LOCA 최대 ${CARD_DISCOUNT_MAX.toLocaleString()}원`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
