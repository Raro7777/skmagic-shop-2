/**
 * SK매직 2026-06 정책 (xlsx) → DB import.
 *
 * 5월 정책 v4 스크립트 (`apply-policy-may-2026.ts`, `apply-price-tiers-may-2026.ts`,
 * `apply-rival-compensation-may-2026.ts`) 의 통합 후속본.
 *
 * 6월 xlsx 구조 변경점 (vs 5월 v4):
 *   - 시트는 1개만: `판매수수료_6월` (5월 v4의 `>일시불 변동가`, `단종`, `원본` 시트 없음)
 *   - 총 22 cols (5월 21 cols 대비 +1) — col[10] 에 "♡6월 판촉가2♡ / 타사 보상" 신설
 *   - 따라서 컬럼 인덱스가 col[10] 부터 한 칸씩 우측 시프트
 *     - 5월 [10] 기본수수료 → 6월 [11]
 *     - 5월 [15] 수수료합계 → 6월 [16]
 *     - 5월 [17] 단종     → 6월 [19]
 *
 * 6월 col 매핑 (R13 부터 데이터):
 *   [2] productCode
 *   [3] 컬러/사이즈/기능 (mode indicator: * 방문형 * / * 셀프형 *)
 *   [4] 의무기간 (contractPeriod)
 *   [5] 소유권기간
 *   [6] 관리주기 (visitInterval)
 *   [7] 기준가  (basePrice, VAT 포함)
 *   [8] 운영가  (rentalPrice, VAT 포함)
 *   [9] ★6월 판촉가★ (promoPrice, VAT 포함) — 기본 할인
 *   [10] ♡6월 판촉가2♡ / 타사 보상 (rivalCompensationPrice, VAT 포함) — 전사 할인 / 타사 보상
 *   [11] 기본 판매수수료 (VAT 포함)
 *   [12] ★6월 전사판촉 판매수수료 (VAT 포함)
 *   [13] ★6월 장려금 — 핵심모델
 *   [14] 직수 주력모델
 *   [15] 얼음 주력모델
 *   [16] 수수료 합계 (VAT 포함) ← HqPolicy.baseCommission 적용 대상 (÷1.1)
 *   [17] 출시
 *   [18] (비어있음, 헤더상 단종/운영중지)
 *   [19] 단종/운영중지 (실제 데이터)
 *   [20] 비고
 *
 * 처리 룰 (5월과 동일):
 *   1) HqPolicy.baseCommission ← col[16] 수수료합계 ÷ 1.1 (공급가액)
 *      monthIncentive = 0 (5월과 동일, 합계만 사용)
 *      installSubsidy = 30,000 (신규 행 생성 시)
 *   2) Product.priceMatrix 옵션의 basePrice/rentalPrice/promoPrice/
 *      rivalCompensationPrice 갱신 (모두 VAT 포함값 그대로 저장)
 *      cardDiscountPrice = (promo ?? rental) − 23,000 (음수 clamp)
 *   3) Product top-level (baseRentalPrice/rentalPrice/promoRentalPrice/cardDiscountPrice)
 *      — Product.contractPeriod 와 일치하는 옵션 (mode 무관, 셀프형 우선) 미러
 *   4) 단종/운영종료(통합운영 X) 행은 옵션 제외
 *
 * 적용 모드:
 *   DRY_RUN=1 (default) → 변경 카운트만 보고, DB 미터치
 *   APPLY=1            → 실제 갱신 (또는 --apply 플래그)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  VAT_RATE,
  REFUND_LIMIT_RATIO,
  INSTALL_SUBSIDY_DEFAULT,
  CARD_DISCOUNT_MAX,
} from "@/lib/constants/pricing";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// ─────────────────────────────────────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────────────────────────────────────

const PATH =
  process.env.JUNE_XLSX_PATH ||
  "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_6월_제품_수수료표_0528_수정v2.xlsx";
const SHEET = "판매수수료_6월";
const DATA_START_ROW = 12;          // R13 부터 (0-index 12)

// 6월 컬럼 인덱스
const COL = {
  productCode: 2,
  variantLabel: 3,
  contractPeriod: 4,
  ownershipPeriod: 5,
  visitInterval: 6,
  basePrice: 7,
  rentalPrice: 8,
  promoPrice: 9,
  rivalCompensation: 10,
  commissionTotal: 16,
  discontinuedHint1: 18,
  discontinuedHint2: 19,
  discontinuedHint3: 20,
} as const;

// --apply 또는 APPLY=1 이면 실제 적용. 아무것도 없으면 DRY_RUN (default).
const APPLY = process.argv.includes("--apply") || process.env.APPLY === "1";
const DRY_RUN = !APPLY;

// ─────────────────────────────────────────────────────────────────────────────
// 파싱 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("ko-KR"));

function parseNumber(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || t === "-" || t.toUpperCase() === "X") return null;
  const n = Number(t.replace(/[, \s원]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detectMode(label: string): "방문형" | "셀프형" | null {
  if (/방문/.test(label)) return "방문형";
  if (/셀프|자가|Lite/i.test(label)) return "셀프형"; // Lite 는 셀프형 계열 (5월 룰 유지)
  return null;
}

type SheetRow = {
  productCode: string;
  mode: "방문형" | "셀프형" | null;
  variantLabel: string;
  contractPeriod: number;
  ownershipPeriod: number | null;
  visitInterval: string;
  basePrice: number | null;
  rentalPrice: number | null;
  promoPrice: number | null;
  rivalCompensationPrice: number | null;
  commissionTotal: number | null;
  discontinued: boolean;
};

function parseSheet(): SheetRow[] {
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets[SHEET];
  if (!sheet) throw new Error(`시트 "${SHEET}" 없음. 보유 시트: ${wb.SheetNames.join(", ")}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

  const out: SheetRow[] = [];
  const lastModeForCode: Record<string, "방문형" | "셀프형" | null> = {};
  let lastCode = "";

  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeRaw = String(r[COL.productCode] ?? "").trim();
    const code = codeRaw || lastCode;
    if (codeRaw) {
      lastCode = codeRaw;
      if (!(code in lastModeForCode)) lastModeForCode[code] = null;
    }
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;

    const variantLabel = String(r[COL.variantLabel] ?? "").trim();
    const detected = detectMode(variantLabel);
    if (detected) lastModeForCode[code] = detected;
    const mode = detected ?? lastModeForCode[code] ?? null;

    const contractPeriod = parseNumber(String(r[COL.contractPeriod] ?? ""));
    if (!contractPeriod) continue;

    const discontText =
      `${r[COL.discontinuedHint1] ?? ""}${r[COL.discontinuedHint2] ?? ""}${r[COL.discontinuedHint3] ?? ""}`;
    const discontinued =
      /단종|운영중지|미운영/.test(discontText) ||
      (/운영종료/.test(discontText) && !/통합운영/.test(discontText));

    out.push({
      productCode: code,
      mode,
      variantLabel,
      contractPeriod,
      ownershipPeriod: parseNumber(String(r[COL.ownershipPeriod] ?? "")),
      visitInterval: String(r[COL.visitInterval] ?? "").trim(),
      basePrice: parseNumber(String(r[COL.basePrice] ?? "")),
      rentalPrice: parseNumber(String(r[COL.rentalPrice] ?? "")),
      promoPrice: parseNumber(String(r[COL.promoPrice] ?? "")),
      rivalCompensationPrice: parseNumber(String(r[COL.rivalCompensation] ?? "")),
      commissionTotal: parseNumber(String(r[COL.commissionTotal] ?? "")),
      discontinued,
    });
  }
  return out;
}

function managementTypeToMode(mt: string): "방문형" | "셀프형" {
  if (mt.includes("자가") || mt.includes("셀프")) return "셀프형";
  return "방문형";
}

type ExistingPriceOpt = {
  mode: "방문형" | "셀프형" | null;
  variantLabel?: string;
  contractPeriod: number;
  ownershipPeriod?: number | null;
  visitInterval?: string;
  rentalPrice?: number | null;
  cardDiscountPrice?: number | null;
  baseCommission?: number | null;
  basePrice?: number | null;
  promoPrice?: number | null;
  rivalCompensationPrice?: number | null;
  rivalCompensationHalfPriceMonths?: number | null;
};

function optionKey(o: { mode: string | null; contractPeriod: number }): string {
  return `${o.mode ?? "단일"}|${o.contractPeriod}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`▶ ${DRY_RUN ? "DRY-RUN" : "APPLY"} : SK매직 2026-06 정책 import`);
  console.log(`  📁 ${PATH}\n`);

  const sheetRows = parseSheet();
  const allCodes = new Set(sheetRows.map((r) => r.productCode));
  console.log(`📋 xlsx 파싱 — 행 ${sheetRows.length}건 / 고유 productCode ${allCodes.size}개`);

  // 유효 옵션: 단종 행 제외 + 가격/수수료 둘 다 없는 행 제외
  const validRows = sheetRows.filter(
    (r) => !r.discontinued && (r.rentalPrice != null || r.commissionTotal != null),
  );
  const byCode = new Map<string, SheetRow[]>();
  for (const r of validRows) {
    if (!byCode.has(r.productCode)) byCode.set(r.productCode, []);
    byCode.get(r.productCode)!.push(r);
  }
  console.log(`📋 유효 옵션 (단종 제외): ${validRows.length}건 / 고유 ${byCode.size}개\n`);

  // DB Product 조회
  const products = await prisma.product.findMany({
    select: {
      id: true,
      productCode: true,
      name: true,
      managementType: true,
      contractPeriod: true,
      status: true,
      rentalPrice: true,
      baseRentalPrice: true,
      promoRentalPrice: true,
      cardDiscountPrice: true,
      priceMatrix: true,
    },
  });
  const dbCodes = new Set(products.map((p) => p.productCode));
  console.log(`📦 DB Product ${products.length}개 (활성/비활성 무관)\n`);

  // ───── 1) 신규/단종 코드 추출 ─────
  const newCodes = [...allCodes].filter((c) => !dbCodes.has(c)).sort();
  const missingFromJune = products.filter((p) => !allCodes.has(p.productCode));
  // 단종 의심: DB 에는 있는데 6월 xlsx 에는 단종 마크로 표시된 코드
  const junePolicyDiscontCodes = new Set(
    sheetRows.filter((r) => r.discontinued).map((r) => r.productCode),
  );
  // 단종 행만 있고 유효행이 없는 코드만 진짜 단종 후보
  const discontinuedCandidates = [...junePolicyDiscontCodes].filter((c) => !byCode.has(c));

  // ───── 2) HqPolicy 업서트 ─────
  let hqCreates = 0;
  let hqUpdates = 0;
  let hqUnchanged = 0;
  let hqUnmatched = 0;
  const hqSampleChanges: string[] = [];

  for (const p of products) {
    const sheetOpts = byCode.get(p.productCode);
    if (!sheetOpts) {
      hqUnmatched++;
      continue;
    }

    for (const o of sheetOpts) {
      if (o.commissionTotal == null) continue;
      const mode = o.mode ?? managementTypeToMode(p.managementType);
      const commVatExcl = Math.round(o.commissionTotal / VAT_RATE);

      const existing = await prisma.hqPolicy.findUnique({
        where: {
          productId_mode_contractPeriod: {
            productId: p.id,
            mode,
            contractPeriod: o.contractPeriod,
          },
        },
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
              installSubsidy: INSTALL_SUBSIDY_DEFAULT,
              refundLimitRatio: REFUND_LIMIT_RATIO,
            },
          });
        }
        hqCreates++;
        continue;
      }

      if (existing.baseCommission === commVatExcl && (existing.monthIncentive ?? 0) === 0) {
        hqUnchanged++;
        continue;
      }

      if (
        hqSampleChanges.length < 25 &&
        Math.abs(existing.baseCommission - commVatExcl) > 5000
      ) {
        hqSampleChanges.push(
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
            // marginType / marginAmount / marginPercent — 운영값 보존
          },
        });
        await prisma.productChangeLog.create({
          data: {
            productId: p.id,
            fieldName: `hqPolicy(${mode},${o.contractPeriod}m).baseCommission`,
            oldValue: String(existing.baseCommission),
            newValue: String(commVatExcl),
            source: "hq_policy_june2026_multirow",
            triggeredById: null,
          },
        });
      }
      hqUpdates++;
    }
  }

  // ───── 3) Product priceMatrix + top-level 가격 갱신 ─────
  let matrixUpdated = 0;
  let topLevelUpdated = 0;
  let topLevelRentalDiff = 0;
  let topLevelBaseDiff = 0;
  let topLevelPromoDiff = 0;
  let topLevelCardDiff = 0;
  let rivalOptionsApplied = 0;
  const priceSampleChanges: string[] = [];

  for (const p of products) {
    const sheetOpts = byCode.get(p.productCode);
    if (!sheetOpts) continue;

    const sheetByKey = new Map<string, SheetRow>();
    for (const o of sheetOpts) sheetByKey.set(optionKey(o), o);

    const dbMatrix = (p.priceMatrix as unknown as ExistingPriceOpt[] | null) ?? [];
    let localChanges = 0;
    const updatedMatrix: ExistingPriceOpt[] = dbMatrix.map((opt) => {
      const key = optionKey(opt);
      const sheet = sheetByKey.get(key);
      if (!sheet) return opt;
      const newRental = sheet.rentalPrice ?? opt.rentalPrice ?? null;
      const newBase = sheet.basePrice ?? opt.basePrice ?? null;
      const newPromo = sheet.promoPrice ?? null;
      const newRival = sheet.rivalCompensationPrice ?? opt.rivalCompensationPrice ?? null;
      const effective = newPromo ?? newRental;
      const newCard = effective != null ? Math.max(0, effective - CARD_DISCOUNT_MAX) : null;

      const changed =
        opt.basePrice !== newBase ||
        opt.rentalPrice !== newRental ||
        opt.promoPrice !== newPromo ||
        opt.rivalCompensationPrice !== newRival ||
        opt.cardDiscountPrice !== newCard;

      if (changed) localChanges++;
      if (newRival != null) rivalOptionsApplied++;

      return {
        ...opt,
        basePrice: newBase,
        rentalPrice: newRental,
        promoPrice: newPromo,
        rivalCompensationPrice: newRival,
        // rivalCompensationHalfPriceMonths 는 6월 xlsx 에 명시 없음 → 기존값 유지
        cardDiscountPrice: newCard,
      };
    });

    if (localChanges > 0) {
      matrixUpdated++;
      if (priceSampleChanges.length < 15) {
        priceSampleChanges.push(`  ${p.productCode.padEnd(14)} ${p.name.slice(0, 25).padEnd(25)} +${localChanges}개 옵션`);
      }
    }

    // ───── Top-level Product (DB.contractPeriod 일치 옵션 우선) ─────
    const defaultPeriod = p.contractPeriod;
    const preferSelf =
      p.managementType.includes("자가") || p.managementType.includes("셀프");
    const candidate =
      sheetOpts.find(
        (o) => o.contractPeriod === defaultPeriod && (preferSelf ? o.mode === "셀프형" : o.mode === "방문형"),
      ) ??
      sheetOpts.find((o) => o.contractPeriod === defaultPeriod) ??
      sheetOpts.find((o) => o.contractPeriod === 60) ??
      sheetOpts[0];

    const newBaseTop = candidate?.basePrice ?? null;
    const newRentalTop = candidate?.rentalPrice ?? p.rentalPrice;
    const newPromoTop = candidate?.promoPrice ?? null;
    const newCardEff = newPromoTop ?? newRentalTop;
    const newCardTop = newCardEff != null ? Math.max(0, newCardEff - CARD_DISCOUNT_MAX) : null;

    const willUpdateTop =
      p.baseRentalPrice !== newBaseTop ||
      p.rentalPrice !== newRentalTop ||
      p.promoRentalPrice !== newPromoTop ||
      p.cardDiscountPrice !== newCardTop;

    if (willUpdateTop) {
      topLevelUpdated++;
      if (p.baseRentalPrice !== newBaseTop) topLevelBaseDiff++;
      if (p.rentalPrice !== newRentalTop) topLevelRentalDiff++;
      if (p.promoRentalPrice !== newPromoTop) topLevelPromoDiff++;
      if (p.cardDiscountPrice !== newCardTop) topLevelCardDiff++;
    }

    if (APPLY) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          baseRentalPrice: newBaseTop,
          rentalPrice: newRentalTop ?? p.rentalPrice,
          promoRentalPrice: newPromoTop,
          cardDiscountPrice: newCardTop,
          priceMatrix: updatedMatrix as unknown as object,
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 보고
  // ─────────────────────────────────────────────────────────────────────────────

  console.log(`══ ${DRY_RUN ? "DRY-RUN" : "APPLY"} 결과 ══\n`);

  console.log(`[A] HqPolicy (다중행 × mode × contractPeriod)`);
  console.log(`    신규 생성       : ${hqCreates}`);
  console.log(`    기존 갱신       : ${hqUpdates}`);
  console.log(`    변경 없음       : ${hqUnchanged}`);
  console.log(`    xlsx 미존재 코드: ${hqUnmatched} (Product)`);
  if (hqSampleChanges.length > 0) {
    console.log(`    변경 폭 5천원↑ 샘플 (최대 25건):`);
    for (const s of hqSampleChanges) console.log(s);
  }

  console.log(`\n[B] Product priceMatrix + top-level 가격`);
  console.log(`    priceMatrix 갱신 Product : ${matrixUpdated}`);
  console.log(`    top-level 갱신 Product   : ${topLevelUpdated}`);
  console.log(`      - baseRentalPrice  : ${topLevelBaseDiff}`);
  console.log(`      - rentalPrice      : ${topLevelRentalDiff}`);
  console.log(`      - promoRentalPrice : ${topLevelPromoDiff}`);
  console.log(`      - cardDiscountPrice: ${topLevelCardDiff}`);
  console.log(`    타사보상 옵션 적용       : ${rivalOptionsApplied}건 (xlsx col[10] 직접 반영)`);
  if (priceSampleChanges.length > 0) {
    console.log(`\n    priceMatrix 변경 샘플:`);
    for (const s of priceSampleChanges) console.log(s);
  }

  console.log(`\n[C] 신규 productCode (DB 에 없음 — Product 신규 생성 대상)`);
  console.log(`    합계: ${newCodes.length}개`);
  for (const c of newCodes.slice(0, 10)) console.log(`    - ${c}`);
  if (newCodes.length > 10) console.log(`    ... +${newCodes.length - 10}개`);
  if (newCodes.length > 0) {
    console.log(
      `    ⚠ 본 스크립트는 신규 Product row 를 자동 생성하지 않음. 본사 확인 후 별도 시드 필요.`,
    );
  }

  console.log(`\n[D] DB 에 있으나 6월 xlsx 에 없는 Product`);
  console.log(`    합계: ${missingFromJune.length}개`);
  for (const p of missingFromJune.slice(0, 10)) {
    console.log(`    - ${p.productCode.padEnd(14)} ${p.name.slice(0, 30)} (status=${p.status})`);
  }
  if (missingFromJune.length > 10) console.log(`    ... +${missingFromJune.length - 10}개`);

  console.log(`\n[E] 6월 xlsx 내 단종/운영종료 마크 (자동 처리 X — 본사 확인 필요)`);
  console.log(`    합계: ${discontinuedCandidates.length}개`);
  for (const c of discontinuedCandidates.slice(0, 10)) console.log(`    - ${c}`);
  if (discontinuedCandidates.length > 10) console.log(`    ... +${discontinuedCandidates.length - 10}개`);

  // ─────────────────────────────────────────────────────────────────────────────
  // VAT 샘플 검증
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n[F] VAT 검증 (수수료합계 ÷1.1 = 깔끔한 정수인지)`);
  const vatSamples = ["WPUPBC204SWH", "WPUIAC425SNS", "WPUJAC125SVB", "WPUMAC306SWH"];
  for (const code of vatSamples) {
    const opts = byCode.get(code);
    if (!opts) {
      console.log(`    ${code}: xlsx 미존재`);
      continue;
    }
    const visit36 = opts.find((o) => o.mode === "방문형" && o.contractPeriod === 36);
    if (!visit36 || visit36.commissionTotal == null) {
      console.log(`    ${code}: 방문형 36m 없음`);
      continue;
    }
    const supply = visit36.commissionTotal / VAT_RATE;
    const rounded = Math.round(supply);
    const diff = Math.abs(supply - rounded);
    const clean = diff < 0.01 ? "✓ 정수" : `~${diff.toFixed(2)} 오차`;
    console.log(
      `    ${code} 방문형 36m: ${fmt(visit36.commissionTotal)} ÷1.1 = ${supply.toFixed(2)} → 공급가 ${fmt(rounded)}  [${clean}]`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 적용 후 검증
  // ─────────────────────────────────────────────────────────────────────────────
  if (APPLY) {
    console.log(`\n══ 적용 후 검증 — 샘플 3종의 방문형 36m HqPolicy ══`);
    for (const code of ["WPUMAC306SWH", "WPUIAC425SNS", "WPUJAC125SVB"]) {
      const prod = await prisma.product.findUnique({
        where: { productCode: code },
        select: {
          productCode: true,
          hqPolicies: {
            where: { mode: "방문형", contractPeriod: 36 },
            select: { baseCommission: true },
          },
        },
      });
      const hq = prod?.hqPolicies[0];
      const expected = byCode.get(code)?.find((o) => o.mode === "방문형" && o.contractPeriod === 36);
      const exp =
        expected?.commissionTotal != null ? Math.round(expected.commissionTotal / VAT_RATE) : null;
      const ok = hq != null && exp != null && hq.baseCommission === exp;
      console.log(
        `  ${code.padEnd(14)} 방문형 36m : DB=${fmt(hq?.baseCommission)} / 예상(xlsx÷1.1)=${fmt(exp)}  ${ok ? "✓" : "❌"}`,
      );
    }
  }

  if (DRY_RUN) {
    console.log(
      `\n  💡 실제 적용 — DRY-RUN 결과 검토 후 다음 중 하나:\n     APPLY=1 npx tsx scripts/apply-policy-june-2026.ts\n     또는\n     npx tsx scripts/apply-policy-june-2026.ts --apply`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
