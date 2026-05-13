/**
 * SK매직 5월 정책 엑셀 (2026-05) 을 DB에 적용한다.
 *   - Product.rentalPrice         ← 운영가 [col 8]
 *   - Product.cardDiscountPrice   ← 5월 판촉가 [col 9]
 *   - HqPolicy.baseCommission     ← 수수료 합계 [col 15]
 *   - 변경된 필드는 ProductChangeLog 에 source="hq_policy_may2026" 기록
 *
 * 5월 시트 (판매수수료_5월) 구조:
 *   row 13+ 이 데이터. 각 row 가 (productCode, 컬러/모드, 의무기간) 단위.
 *   60개월 (의무기간=60) row 만 대표값으로 채택 — 4월 스크립트와 같은 룰.
 *   * 방문형 * / * 셀프형 * / * Lite * 라벨이 col[3] 에 들어옴 (없으면 직전 모드 상속).
 *
 *   비고 / 운영중지 컬럼 (col 17, 18) 에 "운영종료" 등이 있으면 스킵.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정_v4_복호화.xlsx";
const SHEET = "판매수수료_5월";
const DATA_START_ROW = 12; // 0-indexed → row 13

type Opt = {
  productCode: string;
  managementMode: "방문형" | "셀프형" | "Lite" | null;
  contractPeriod: number;
  operationPrice: number | null;
  promotionPrice: number | null;
  commissionTotal: number | null;
  discontinued: boolean;
};

function parseNumber(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || t === "-" || t.toUpperCase() === "X") return null;
  const n = Number(t.replace(/[, \s원]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function detectMode(label: string): "방문형" | "셀프형" | "Lite" | null {
  if (/방문/.test(label)) return "방문형";
  if (/셀프|자가/.test(label)) return "셀프형";
  if (/Lite|라이트/i.test(label)) return "Lite";
  return null;
}

function parseSheet(): Opt[] {
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets[SHEET];
  if (!sheet) throw new Error(`시트 "${SHEET}" 없음. 보유 시트: ${wb.SheetNames.join(", ")}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

  const out: Opt[] = [];
  let lastMode: Opt["managementMode"] = null;
  let lastCode = "";
  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeCell = String(r[2] ?? "").trim();
    const code = codeCell || lastCode;
    if (codeCell) lastCode = codeCell;
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;

    // 컬러/모드 라벨 — 모드 표기는 새로 등장할 때만. 이전 mode 유지 룰.
    const variantLabel = String(r[3] ?? "").trim();
    const detected = detectMode(variantLabel);
    if (detected !== null) lastMode = detected;
    // 새 productCode 의 첫 row 인데 모드 라벨이 없으면 초기화
    if (codeCell && detected === null && !variantLabel) lastMode = null;

    const period = parseNumber(String(r[4] ?? ""));
    if (!period) continue;

    const opPrice    = parseNumber(String(r[8]  ?? ""));   // 운영가
    const promo      = parseNumber(String(r[9]  ?? ""));   // 5월 판촉가
    const comm       = parseNumber(String(r[15] ?? ""));   // 수수료 합계
    const discontText = `${r[17] ?? ""}${r[18] ?? ""}${r[19] ?? ""}`;
    const discontinued = /단종|운영종료|운영중지|미운영/.test(discontText);

    out.push({
      productCode: code,
      managementMode: lastMode,
      contractPeriod: period,
      operationPrice: opPrice,
      promotionPrice: promo,
      commissionTotal: comm,
      discontinued,
    });
  }
  return out;
}

async function main() {
  const opts = parseSheet();
  console.log(`📋 시트 파싱 — ${opts.length} 옵션 / 고유 productCode ${new Set(opts.map(o => o.productCode)).size}개`);

  // productCode + 모드별 60개월 대표값 추출
  type Rep = { 방문형?: Opt; 셀프형?: Opt; Lite?: Opt; 단일?: Opt };
  const repByCode = new Map<string, Rep>();
  for (const o of opts) {
    if (o.contractPeriod !== 60) continue;
    if (o.discontinued) continue;
    if (!repByCode.has(o.productCode)) repByCode.set(o.productCode, {});
    const rec = repByCode.get(o.productCode)!;
    if (o.managementMode === "방문형") rec.방문형 = o;
    else if (o.managementMode === "셀프형") rec.셀프형 = o;
    else if (o.managementMode === "Lite") rec.Lite = o;
    else rec.단일 = o;
  }
  console.log(`📋 60개월 대표값 — ${repByCode.size} productCode`);

  const products = await prisma.product.findMany({ include: { hqPolicy: true } });
  console.log(`📦 DB Product ${products.length}개\n`);

  let updatedRental = 0;
  let updatedCard = 0;
  let updatedCommission = 0;
  let createdHqPolicy = 0;
  let logsCreated = 0;
  let touched = 0;
  let unmatched = 0;

  for (const p of products) {
    const rec = repByCode.get(p.productCode);
    if (!rec) { unmatched++; continue; }

    let chosen: Opt | undefined;
    if (p.managementType.includes("자가") || p.managementType.includes("셀프")) {
      chosen = rec.셀프형 ?? rec.단일 ?? rec.방문형 ?? rec.Lite;
    } else if (p.managementType.includes("방문")) {
      chosen = rec.방문형 ?? rec.단일 ?? rec.셀프형 ?? rec.Lite;
    } else {
      chosen = rec.단일 ?? rec.방문형 ?? rec.셀프형 ?? rec.Lite;
    }
    if (!chosen) continue;

    await prisma.$transaction(async tx => {
      const updates: Record<string, unknown> = {};
      const logs: Array<{ fieldName: string; oldValue: string | null; newValue: string }> = [];

      if (chosen.operationPrice != null && p.rentalPrice !== chosen.operationPrice) {
        updates.rentalPrice = chosen.operationPrice;
        logs.push({ fieldName: "rentalPrice", oldValue: String(p.rentalPrice), newValue: String(chosen.operationPrice) });
        updatedRental++;
      }
      if (chosen.promotionPrice != null && p.cardDiscountPrice !== chosen.promotionPrice) {
        updates.cardDiscountPrice = chosen.promotionPrice;
        logs.push({ fieldName: "cardDiscountPrice", oldValue: p.cardDiscountPrice == null ? null : String(p.cardDiscountPrice), newValue: String(chosen.promotionPrice) });
        updatedCard++;
      }

      if (Object.keys(updates).length > 0) {
        await tx.product.update({ where: { id: p.id }, data: updates });
        for (const l of logs) {
          await tx.productChangeLog.create({
            data: {
              productId: p.id,
              fieldName: l.fieldName,
              oldValue: l.oldValue,
              newValue: l.newValue,
              source: "hq_policy_may2026",
              triggeredById: null,
            },
          });
          logsCreated++;
        }
        touched++;
      }

      if (chosen.commissionTotal != null) {
        if (p.hqPolicy) {
          if (p.hqPolicy.baseCommission !== chosen.commissionTotal) {
            await tx.hqPolicy.update({
              where: { productId: p.id },
              data: { baseCommission: chosen.commissionTotal },
            });
            await tx.productChangeLog.create({
              data: {
                productId: p.id,
                fieldName: "hqPolicy.baseCommission",
                oldValue: String(p.hqPolicy.baseCommission),
                newValue: String(chosen.commissionTotal),
                source: "hq_policy_may2026",
              },
            });
            updatedCommission++;
            logsCreated++;
          }
        } else {
          await tx.hqPolicy.create({
            data: {
              productId: p.id,
              baseCommission: chosen.commissionTotal,
              monthIncentive: 0,
              installSubsidy: 30000,
            },
          });
          await tx.productChangeLog.create({
            data: {
              productId: p.id,
              fieldName: "hqPolicy.created",
              oldValue: null,
              newValue: `baseCommission=${chosen.commissionTotal}`,
              source: "hq_policy_may2026",
            },
          });
          createdHqPolicy++;
          logsCreated++;
        }
      }
    });
  }

  console.log(`✅ 적용 결과`);
  console.log(`  Product 갱신                : ${touched}건`);
  console.log(`    rentalPrice 변경          : ${updatedRental}건`);
  console.log(`    cardDiscountPrice 변경    : ${updatedCard}건`);
  console.log(`  HqPolicy 갱신                : ${updatedCommission}건`);
  console.log(`  HqPolicy 신규 생성           : ${createdHqPolicy}건`);
  console.log(`  ProductChangeLog 기록       : ${logsCreated}건`);
  console.log(`  매칭 안된 DB Product         : ${unmatched}건 (시트에 없음)`);

  const totalProducts = await prisma.product.count();
  const totalHqPolicy = await prisma.hqPolicy.count();
  const totalLogs = await prisma.productChangeLog.count({ where: { source: "hq_policy_may2026" } });
  console.log(`\n📊 현재 상태`);
  console.log(`  Product 총 ${totalProducts}개`);
  console.log(`  HqPolicy 총 ${totalHqPolicy}개 (커버리지 ${Math.round(totalHqPolicy / totalProducts * 100)}%)`);
  console.log(`  hq_policy_may2026 변경 이력 누적 ${totalLogs}건`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
