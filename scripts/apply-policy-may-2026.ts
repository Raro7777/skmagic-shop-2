/**
 * SK매직 2026-05 정책 (xlsx) → HqPolicy 다중행 스키마 적용.
 *
 *   목표: HqPolicy 테이블의 모든 (mode × contractPeriod) 행을 xlsx 기반 정확값으로 덮어쓰기.
 *   - HqPolicy.baseCommission ← xlsx col15 ÷ 1.1 (VAT 제외 / 공급가액)
 *   - HqPolicy.monthIncentive ← 0 (5월 정책에는 분리된 인센티브 없음, 합계만 col15)
 *   - HqPolicy.installSubsidy ← 30,000 (기본값, 신규 행 생성 시)
 *   - 마진 필드 (marginType / marginAmount / marginPercent) 는 이미 운영 중인 값 보존.
 *
 *   Product top-level (rentalPrice / baseRentalPrice / promoRentalPrice / cardDiscountPrice) 는
 *   scripts/apply-price-tiers-may-2026.ts 가 담당. 이 스크립트는 손대지 않는다.
 *
 *   xlsx 시트: "판매수수료_5월" — row 13+ 데이터.
 *   col 2=productCode, col 3=mode 라벨, col 4=의무기간, col 15=수수료 합계.
 *
 *   --apply 없으면 dry-run.
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
const DATA_START_ROW = 12;
const VAT_RATE = 1.1;
const APPLY = process.argv.includes("--apply");

type Opt = {
  productCode: string;
  mode: "방문형" | "셀프형" | null;
  contractPeriod: number;
  visitInterval: string;
  commissionTotal: number | null;  // xlsx col 15 (VAT 포함)
  discontinued: boolean;
};

const fmt = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("ko-KR");

function parseNumber(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || t === "-" || t.toUpperCase() === "X") return null;
  const n = Number(t.replace(/[, \s원]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function detectMode(label: string): "방문형" | "셀프형" | null {
  if (/방문/.test(label)) return "방문형";
  if (/셀프|자가|Lite/i.test(label)) return "셀프형";
  return null;
}

function parseSheet(): Opt[] {
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets[SHEET];
  if (!sheet) throw new Error(`시트 "${SHEET}" 없음. 보유 시트: ${wb.SheetNames.join(", ")}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

  const out: Opt[] = [];
  const lastModeForCode: Record<string, "방문형" | "셀프형" | null> = {};
  let lastCode = "";

  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeRaw = String(r[2] ?? "").trim();
    const code = codeRaw || lastCode;
    if (codeRaw) {
      lastCode = codeRaw;
      if (!(code in lastModeForCode)) lastModeForCode[code] = null;
    }
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;

    const variantLabel = String(r[3] ?? "").trim();
    const detected = detectMode(variantLabel);
    if (detected) lastModeForCode[code] = detected;
    const mode = detected ?? lastModeForCode[code] ?? null;

    const period = parseNumber(String(r[4] ?? ""));
    if (!period) continue;

    const commRaw = parseNumber(String(r[15] ?? ""));
    const discontText = `${r[17] ?? ""}${r[18] ?? ""}${r[19] ?? ""}`;
    const discontinued =
      /단종|운영중지|미운영/.test(discontText) ||
      (/운영종료/.test(discontText) && !/통합운영/.test(discontText));

    out.push({
      productCode: code,
      mode,
      contractPeriod: period,
      visitInterval: String(r[6] ?? "").trim(),
      commissionTotal: commRaw,
      discontinued,
    });
  }
  return out;
}

function managementTypeToMode(mt: string): "방문형" | "셀프형" {
  if (mt.includes("자가") || mt.includes("셀프")) return "셀프형";
  return "방문형"; // 방문 관리 / 미정 / 기본 — HqPolicy 의 mode 는 NOT NULL 이라 fallback 필요
}

async function main() {
  console.log(`▶ ${APPLY ? "APPLY" : "DRY-RUN"} : 본사 정책 → HqPolicy 다중행 스키마 적용 (VAT 제외)\n`);
  const opts = parseSheet();
  const productCodes = new Set(opts.map(o => o.productCode));
  console.log(`📋 xlsx 파싱 — 옵션 ${opts.length}건 / 고유 productCode ${productCodes.size}개`);

  // productCode 기준 옵션 그룹화 (단종 / 수수료 누락 제외)
  const byCode = new Map<string, Opt[]>();
  for (const o of opts) {
    if (o.discontinued) continue;
    if (o.commissionTotal == null) continue;
    if (!byCode.has(o.productCode)) byCode.set(o.productCode, []);
    byCode.get(o.productCode)!.push(o);
  }
  console.log(`📋 유효 옵션 (단종 제외 · 수수료 있음): ${[...byCode.values()].reduce((s, a) => s + a.length, 0)}건\n`);

  const products = await prisma.product.findMany({
    select: { id: true, productCode: true, managementType: true, contractPeriod: true },
  });
  console.log(`📦 DB Product ${products.length}개\n`);

  let upsertsExpected = 0;
  let creates = 0;
  let updates = 0;
  let unchanged = 0;
  let unmatched = 0;
  const fixed36m: string[] = [];

  for (const p of products) {
    const sheetOpts = byCode.get(p.productCode);
    if (!sheetOpts) { unmatched++; continue; }

    for (const o of sheetOpts) {
      const mode = o.mode ?? managementTypeToMode(p.managementType);
      const commVatExcl = Math.round((o.commissionTotal ?? 0) / VAT_RATE);
      upsertsExpected++;

      const existing = await prisma.hqPolicy.findUnique({
        where: { productId_mode_contractPeriod: { productId: p.id, mode, contractPeriod: o.contractPeriod } },
      });

      if (!existing) {
        if (APPLY) {
          await prisma.hqPolicy.create({
            data: {
              productId: p.id,
              mode,
              contractPeriod: o.contractPeriod,
              visitInterval: o.visitInterval || null,
              baseCommission: commVatExcl,
              monthIncentive: 0,
              installSubsidy: 30000,
              refundLimitRatio: 0.6667,
            },
          });
        }
        creates++;
        continue;
      }

      if (existing.baseCommission === commVatExcl && (existing.monthIncentive ?? 0) === 0) {
        unchanged++;
        continue;
      }

      // 36m 오염 행 추적용 — 변경 폭이 큰 케이스 일부 샘플
      if (o.contractPeriod === 36 && Math.abs(existing.baseCommission - commVatExcl) > 50000) {
        fixed36m.push(
          `  ${p.productCode.padEnd(14)} ${mode.padEnd(4)} ${String(o.contractPeriod).padStart(2)}m : ` +
          `${fmt(existing.baseCommission).padStart(9)} → ${fmt(commVatExcl).padStart(9)}`,
        );
      }

      if (APPLY) {
        await prisma.hqPolicy.update({
          where: { id: existing.id },
          data: {
            baseCommission: commVatExcl,
            monthIncentive: 0,
            visitInterval: o.visitInterval || existing.visitInterval,
            // 마진 필드 (marginType/marginAmount/marginPercent) 보존 — 손대지 않음.
          },
        });
        await prisma.productChangeLog.create({
          data: {
            productId: p.id,
            fieldName: `hqPolicy(${mode},${o.contractPeriod}m).baseCommission`,
            oldValue: String(existing.baseCommission),
            newValue: String(commVatExcl),
            source: "hq_policy_may2026_multirow",
            triggeredById: null,
          },
        });
      }
      updates++;
    }
  }

  console.log(`══ ${APPLY ? "APPLY 결과" : "DRY-RUN 결과"} ══`);
  console.log(`  upsert 예상 행 수   : ${upsertsExpected}`);
  console.log(`  새로 생성            : ${creates}`);
  console.log(`  기존 행 갱신         : ${updates}`);
  console.log(`  변경 없음            : ${unchanged}`);
  console.log(`  xlsx 에 없는 Product : ${unmatched}`);

  if (fixed36m.length > 0) {
    console.log(`\n  ✏ 36개월 행 보정 샘플 (변경 폭 5만원 이상 · 최대 20건 표시):`);
    for (const s of fixed36m.slice(0, 20)) console.log(s);
    if (fixed36m.length > 20) console.log(`     ... +${fixed36m.length - 20}건 추가`);
  }

  // 적용 후 검증 — 3개 샘플 모델 방문형 36m 행이 xlsx 값과 일치하는지
  if (APPLY) {
    console.log(`\n══ 검증 — 샘플 3종의 방문형 36m 행 ══`);
    for (const code of ["WPUMAC306SWH", "WPUIAC425SNS", "WPUJAC125SVB"]) {
      const prod = await prisma.product.findUnique({
        where: { productCode: code },
        select: {
          productCode: true,
          hqPolicies: { where: { mode: "방문형", contractPeriod: 36 }, select: { baseCommission: true } },
        },
      });
      const hq = prod?.hqPolicies[0];
      const expected = byCode.get(code)?.find(o => o.mode === "방문형" && o.contractPeriod === 36);
      const exp = expected?.commissionTotal != null ? Math.round(expected.commissionTotal / VAT_RATE) : null;
      const ok = hq != null && exp != null && hq.baseCommission === exp;
      console.log(`  ${code.padEnd(14)} 방문형 36m : DB=${fmt(hq?.baseCommission)} / 예상(xlsx÷1.1)=${fmt(exp)}  ${ok ? "✓" : "❌"}`);
    }
  }

  if (!APPLY) {
    console.log(`\n  💡 --apply 플래그로 실제 갱신 (변경 ${creates + updates}건 예상)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
