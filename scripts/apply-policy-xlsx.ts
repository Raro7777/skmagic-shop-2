/**
 * SK매직 4월 정책 엑셀을 DB에 적용한다.
 *   - Product.rentalPrice         ← 운영가
 *   - Product.cardDiscountPrice   ← 4월 판촉가
 *   - HqPolicy.baseCommission     ← 수수료 합계 (vat 제외)
 *   - 변경된 필드는 ProductChangeLog에 source="hq_policy" 로 기록
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직 26년 4월 정책 (부가세 제외 , -0)_1.xlsx";

type Opt = {
  productCode: string;
  managementMode: "방문형" | "셀프형" | null;
  contractPeriod: number;
  operationPrice: number | null;
  promotionPrice: number | null;
  commissionTotal: number | null;
};

function parseNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = String(s).trim();
  if (!t || t === "-" || t.toUpperCase() === "X") return null;
  const n = Number(t.replace(/[, \s원]/g, ""));
  return isFinite(n) ? n : null;
}
function detectMode(label: string): "방문형" | "셀프형" | null {
  if (/방문/.test(label)) return "방문형";
  if (/셀프|자가/.test(label)) return "셀프형";
  return null;
}
function splitLines(s: string | null | undefined): string[] {
  if (s == null) return [];
  return String(s).split(/[\n\r]+/).map(t => t.trim()).filter(t => t.length > 0);
}

function parseSheet(): Opt[] {
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
  const out: Opt[] = [];
  let lastCode = "";
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const code = String(r[2] ?? "").trim() || lastCode;
    if (String(r[2] ?? "").trim()) lastCode = String(r[2]).trim();
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;
    const variantLabel = String(r[3] ?? "").trim();
    const contractLines = splitLines(r[4] as string);
    const opPriceLines  = splitLines(r[7] as string);
    const promoLines    = splitLines(r[8] as string);
    const commLines     = splitLines(r[9] as string);
    for (let k = 0; k < contractLines.length; k++) {
      const period = Number(contractLines[k]);
      if (!isFinite(period)) continue;
      out.push({
        productCode: code,
        managementMode: detectMode(variantLabel),
        contractPeriod: period,
        operationPrice: parseNumber(opPriceLines[k]),
        promotionPrice: parseNumber(promoLines[k]),
        commissionTotal: parseNumber(commLines[k]),
      });
    }
  }
  return out;
}

async function main() {
  const opts = parseSheet();
  // productCode + 모드별 60개월 옵션만 추출
  type Rep = { 방문형?: Opt; 셀프형?: Opt; 단일?: Opt };
  const repByCode = new Map<string, Rep>();
  for (const o of opts) {
    if (o.contractPeriod !== 60) continue;
    if (!repByCode.has(o.productCode)) repByCode.set(o.productCode, {});
    const rec = repByCode.get(o.productCode)!;
    if (o.managementMode === "방문형") rec.방문형 = o;
    else if (o.managementMode === "셀프형") rec.셀프형 = o;
    else rec.단일 = o;
  }

  const products = await prisma.product.findMany({
    include: { hqPolicy: true },
  });

  let updatedRental = 0;
  let updatedCard = 0;
  let updatedCommission = 0;
  let createdHqPolicy = 0;
  let logsCreated = 0;
  let touched = 0;

  for (const p of products) {
    const rec = repByCode.get(p.productCode);
    if (!rec) continue;

    let chosen: Opt | undefined;
    if (p.managementType.includes("자가") || p.managementType.includes("셀프")) {
      chosen = rec.셀프형 ?? rec.단일 ?? rec.방문형;
    } else if (p.managementType.includes("방문")) {
      chosen = rec.방문형 ?? rec.단일 ?? rec.셀프형;
    } else {
      chosen = rec.단일 ?? rec.방문형 ?? rec.셀프형;
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
              source: "hq_policy",
              triggeredById: null,
            },
          });
          logsCreated++;
        }
        touched++;
      }

      // HqPolicy 갱신/생성
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
                source: "hq_policy",
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
              source: "hq_policy",
            },
          });
          createdHqPolicy++;
          logsCreated++;
        }
      }
    });
  }

  console.log(`✅ 적용 결과`);
  console.log(`  Product 갱신             : ${touched}건`);
  console.log(`    - rentalPrice 변경     : ${updatedRental}건`);
  console.log(`    - cardDiscountPrice 변경 : ${updatedCard}건`);
  console.log(`  HqPolicy 갱신             : ${updatedCommission}건`);
  console.log(`  HqPolicy 신규 생성        : ${createdHqPolicy}건`);
  console.log(`  ProductChangeLog 기록    : ${logsCreated}건`);

  // 결과 요약
  const totalProducts = await prisma.product.count();
  const totalHqPolicy = await prisma.hqPolicy.count();
  const totalLogs = await prisma.productChangeLog.count({ where: { source: "hq_policy" } });
  console.log(`\n📊 현재 상태`);
  console.log(`  Product 총 ${totalProducts}개`);
  console.log(`  HqPolicy 총 ${totalHqPolicy}개 (커버리지 ${Math.round(totalHqPolicy / totalProducts * 100)}%)`);
  console.log(`  hq_policy 변경 이력 누적 ${totalLogs}건`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
