/**
 * 5월 정책서 v4 (판매수수료_5월 시트) 의 기준가/운영가/판촉가 3-tier 를
 * 우리 DB priceMatrix + Product top-level 에 반영.
 *
 * 시트 컬럼 (R12 이후 데이터):
 *   [2] 제품코드
 *   [3] 컬러/사이즈/기능 (mode indicator: * 방문형 * / * 셀프형 *)
 *   [4] 의무기간 (계약기간)
 *   [5] 소유권기간
 *   [6] 관리주기
 *   [7] 기준가
 *   [8] 운영가
 *   [9] ★5월 판촉가★
 *   [15] 수수료 합계
 *
 * 처리:
 *   1) productCode 별 옵션 그룹화 (mode × contractPeriod)
 *   2) 각 옵션의 basePrice/rentalPrice/promoPrice 추출
 *   3) DB.priceMatrix 옵션과 (mode, contractPeriod) 매칭하여 가격 3종 업데이트
 *      cardDiscountPrice 는 effective − 23,000 으로 재계산 (effective = promo ?? rental)
 *      rivalCompensationPrice / HalfMonths 는 유지 (별도 PDF 출처)
 *   4) Product top-level: 60개월 옵션 또는 contractPeriod 일치하는 옵션 기준으로
 *      baseRentalPrice / rentalPrice / promoRentalPrice / cardDiscountPrice 미러
 *
 * --apply 플래그 없으면 dry-run.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_5월_제품_수수료표_0429_수정_v4_복호화(1).xlsx";
const SHEET_NAME = "판매수수료_5월";
const CARD_DISCOUNT = 23000; // 본사 매직몰 카드할인 최대 금액 (2026-05)
const APPLY = process.argv.includes("--apply");

type PolicyRow = {
  productCode: string;
  mode: "방문형" | "셀프형" | null;
  variantLabel: string;
  contractPeriod: number;
  ownershipPeriod: number | null;
  visitInterval: string;
  basePrice: number | null;
  rentalPrice: number | null;     // 운영가
  promoPrice: number | null;       // 판촉가
  commission: number | null;
};

function parseNumber(s: string | null | undefined): number | null {
  if (s == null) return null;
  const trimmed = String(s).trim();
  if (!trimmed || trimmed === "-" || trimmed.toUpperCase() === "X") return null;
  const cleaned = trimmed.replace(/[, \s원]/g, "");
  const n = Number(cleaned);
  return isFinite(n) && n > 0 ? n : null;
}

function detectMode(label: string): "방문형" | "셀프형" | null {
  if (/방문/.test(label)) return "방문형";
  if (/셀프|자가/.test(label)) return "셀프형";
  return null;
}

function parseSheet(): PolicyRow[] {
  const wb = XLSX.readFile(PATH);
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`sheet not found: ${SHEET_NAME}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });

  const out: PolicyRow[] = [];
  let lastCode = "";
  let lastMode: "방문형" | "셀프형" | null = null;
  let lastVariant = "";

  // 데이터는 R12 부터 (R9-R11 헤더). v4 파일은 productCode 가 매 행에 반복되고
  // mode 표시 (* 방문형 *)는 각 모드 블록의 첫 행에만 있음. 같은 productCode 연속 행에서
  // mode 를 inherit 해야 함.
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeRaw = String(r[2] ?? "").trim();
    const code = codeRaw || lastCode;
    if (!code) continue;
    if (!/^[A-Z][A-Z0-9]{6,}$/.test(code)) continue;

    const variantRaw = String(r[3] ?? "").trim();
    const newMode = detectMode(variantRaw);
    const isNewProduct = codeRaw && codeRaw !== lastCode;

    let mode: "방문형" | "셀프형" | null;
    if (newMode) {
      // 모드 명시 행 — lastMode 갱신
      mode = newMode;
      lastMode = newMode;
      lastVariant = variantRaw;
    } else if (isNewProduct) {
      // 새 productCode 인데 모드 표시 없음 → 단일 모드 (예: 비데 단일관리)
      mode = null;
      lastMode = null;
      lastVariant = "";
    } else {
      // 같은 productCode 의 추가 약정기간 행 — 이전 mode 상속
      mode = lastMode;
    }

    if (codeRaw) lastCode = codeRaw;

    const contractPeriod = parseNumber(String(r[4] ?? ""));
    const ownership      = parseNumber(String(r[5] ?? ""));
    const visit          = String(r[6] ?? "").trim();
    const basePrice      = parseNumber(String(r[7] ?? ""));
    const rentalPrice    = parseNumber(String(r[8] ?? ""));
    const promoPrice     = parseNumber(String(r[9] ?? ""));
    const commission     = parseNumber(String(r[15] ?? ""));

    if (!contractPeriod) continue;

    out.push({
      productCode: code,
      mode,
      variantLabel: lastVariant,
      contractPeriod,
      ownershipPeriod: ownership,
      visitInterval: visit,
      basePrice,
      rentalPrice,
      promoPrice,
      commission,
    });
  }
  return out;
}

type ExistingOption = {
  mode: "방문형" | "셀프형" | null;
  variantLabel: string;
  contractPeriod: number;
  ownershipPeriod: number | null;
  visitInterval: string;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  baseCommission: number | null;
  basePrice?: number | null;
  promoPrice?: number | null;
  rivalCompensationPrice?: number | null;
  rivalCompensationHalfPriceMonths?: number | null;
};

function optionKey(opt: { mode: string | null; contractPeriod: number }): string {
  return `${opt.mode ?? "단일"}|${opt.contractPeriod}`;
}

async function main() {
  console.log(`▶ ${APPLY ? "APPLY" : "DRY-RUN"} 모드. xlsx 파싱 중...`);
  const xlsxRows = parseSheet();
  console.log(`  - 시트 옵션 ${xlsxRows.length}건`);

  const xlsxByCode = new Map<string, PolicyRow[]>();
  for (const r of xlsxRows) {
    if (!xlsxByCode.has(r.productCode)) xlsxByCode.set(r.productCode, []);
    xlsxByCode.get(r.productCode)!.push(r);
  }
  console.log(`  - 고유 productCode ${xlsxByCode.size}개\n`);

  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: {
      id: true, productCode: true, name: true, contractPeriod: true,
      managementType: true, rentalPrice: true, cardDiscountPrice: true,
      baseRentalPrice: true, promoRentalPrice: true, priceMatrix: true,
    },
  });
  console.log(`▶ active Product: ${products.length}개`);

  let matchedProducts = 0;
  let optionUpdates = 0;
  let topLevelUpdates = 0;
  let promoApplied = 0;
  const skipped: string[] = [];

  for (const p of products) {
    const sheetOpts = xlsxByCode.get(p.productCode);
    if (!sheetOpts) { skipped.push(`${p.productCode} (시트 미존재)`); continue; }
    matchedProducts++;

    const sheetByKey = new Map<string, PolicyRow>();
    for (const o of sheetOpts) sheetByKey.set(optionKey(o), o);

    const dbMatrix = (p.priceMatrix as unknown as ExistingOption[] | null) ?? [];
    const updatedMatrix: ExistingOption[] = dbMatrix.map(opt => {
      const key = optionKey(opt);
      const sheet = sheetByKey.get(key);
      if (!sheet) return opt; // 시트에 없는 옵션 (별도 모드 등) — 보존
      optionUpdates++;
      const newRental = sheet.rentalPrice ?? opt.rentalPrice;
      const newBase = sheet.basePrice;
      const newPromo = sheet.promoPrice;
      if (newPromo != null) promoApplied++;
      // 카드할인 — effective(promo ?? rental) − 15k. 음수는 null 처리 (혜택 의미 없음).
      const effective = newPromo ?? newRental;
      const newCard = effective != null && effective > CARD_DISCOUNT ? effective - CARD_DISCOUNT : null;
      return {
        ...opt,
        basePrice: newBase,
        rentalPrice: newRental,
        promoPrice: newPromo,
        cardDiscountPrice: newCard,
        // rivalCompensationPrice / HalfMonths 는 손대지 않음
      };
    });

    // Top-level Product — DB 의 default contractPeriod 와 일치하는 시트 옵션 선택 (mode 무관, 셀프 우선)
    const defaultPeriod = p.contractPeriod;
    const preferSelf = p.managementType.includes("자가") || p.managementType.includes("셀프");
    const candidate =
      sheetOpts.find(o => o.contractPeriod === defaultPeriod && (preferSelf ? o.mode === "셀프형" : o.mode === "방문형")) ??
      sheetOpts.find(o => o.contractPeriod === defaultPeriod) ??
      sheetOpts.find(o => o.contractPeriod === 60) ??
      sheetOpts[0];

    const newBase = candidate?.basePrice ?? null;
    const newRental = candidate?.rentalPrice ?? p.rentalPrice;
    const newPromo = candidate?.promoPrice ?? null;
    const newCardEffective = newPromo ?? newRental;
    const newCard = newCardEffective != null && newCardEffective > CARD_DISCOUNT ? newCardEffective - CARD_DISCOUNT : null;

    const willUpdateTop =
      p.baseRentalPrice !== newBase ||
      p.rentalPrice !== newRental ||
      p.promoRentalPrice !== newPromo ||
      p.cardDiscountPrice !== newCard;
    if (willUpdateTop) topLevelUpdates++;

    if (APPLY) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          baseRentalPrice: newBase,
          rentalPrice: newRental,
          promoRentalPrice: newPromo,
          cardDiscountPrice: newCard,
          priceMatrix: updatedMatrix as unknown as object,
        },
      });
    }
  }

  console.log(`\n══ ${APPLY ? "적용 완료" : "DRY-RUN 결과"} ══`);
  console.log(`  매칭 Product   : ${matchedProducts} / ${products.length}`);
  console.log(`  옵션 업데이트  : ${optionUpdates}건 (priceMatrix)`);
  console.log(`  Product 상단 갱신: ${topLevelUpdates}건`);
  console.log(`  판촉가 옵션    : ${promoApplied}건`);
  if (skipped.length > 0) {
    console.log(`\n  ⚠ 시트 미존재 (${skipped.length}건):`);
    for (const s of skipped.slice(0, 20)) console.log(`     - ${s}`);
    if (skipped.length > 20) console.log(`     ... +${skipped.length - 20}`);
  }
  if (!APPLY) console.log(`\n  💡 적용하려면 --apply 플래그 추가`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
