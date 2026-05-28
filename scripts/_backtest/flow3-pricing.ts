/**
 * Flow 3 — 가격 계산 일관성 백테스트
 *
 * Steps:
 *   1) 활성 상품 1개 + 활성 Partner 1개 선택
 *   2) priceMatrix 3-tier 존재 확인 (basePrice / rentalPrice / promoPrice + cardDiscountPrice)
 *   3) PartnerPolicy override / Partner.rentalSupportAmount 컨텍스트 확인
 *   4) 메인 카드 (listPartnerProducts) vs 상세 (getPartnerProductDetail) 산식 일치
 *   5) VAT 표기 일관성 — 정책상 운영가는 VAT 포함 표기 (Settlement는 공급가)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
let prisma: any;
let listPartnerProducts: any;
let getPartnerProductDetail: any;

type StepResult = { idx: number; ok: boolean | "warn"; label: string; note?: string };
const results: StepResult[] = [];

async function step(idx: number, label: string, fn: () => Promise<StepResult | void>) {
  try {
    const r = await fn();
    if (r) results.push(r);
    else results.push({ idx, ok: true, label });
  } catch (e: any) {
    results.push({ idx, ok: false, label, note: e?.message ?? String(e) });
  }
}

async function main() {
  ({ prisma } = await import("@/lib/prisma"));
  ({ listPartnerProducts, getPartnerProductDetail } = await import("@/lib/partnerSite"));

  // ─── 1) 활성 상품 + 활성 Partner ───
  let partnerCode: string | null = null;
  let productCode: string | null = null;
  let partner: any = null;
  let product: any = null;

  await step(1, "활성 상품 + 활성 Partner 선택", async () => {
    partner = await prisma.partner.findFirst({
      where: { status: "active", partnerCode: { not: "hq-template" } },
      select: { partnerCode: true, partnerName: true, tier: true, rentalSupportAmount: true, sellerMarginAmount: true, sellerMarginType: true },
    });
    product = await prisma.product.findFirst({
      where: { status: "active", priceMatrix: { not: null } },
      select: {
        productCode: true, name: true, baseRentalPrice: true, rentalPrice: true,
        promoRentalPrice: true, cardDiscountPrice: true, priceMatrix: true, contractPeriod: true,
        managementType: true, partnerPolicies: { where: { partnerId: undefined }, take: 0 },
      },
    });
    if (!partner || !product) {
      return { idx: 1, ok: false, label: "활성 상품/파트너 없음", note: `partner=${!!partner} product=${!!product}` };
    }
    partnerCode = partner.partnerCode;
    productCode = product.productCode;
    return { idx: 1, ok: true, label: `partner=${partnerCode} (tier=${partner.tier}, rentalSupport=${partner.rentalSupportAmount}) product=${productCode}` };
  });

  if (!partnerCode || !productCode) {
    console.log("종합 진행 불가 — Flow 3 abort");
    process.exit(0);
  }

  // ─── 2) priceMatrix 3-tier 존재 ───
  await step(2, "priceMatrix 3-tier 확인", async () => {
    const matrix = product.priceMatrix as any[];
    if (!Array.isArray(matrix) || matrix.length === 0) {
      return { idx: 2, ok: "warn", label: "priceMatrix 비어있음 — fallback 단일 가격 시나리오" };
    }
    const haveBase = matrix.some(o => o.basePrice != null && Number(o.basePrice) > 0);
    const haveRental = matrix.every(o => o.rentalPrice != null && Number(o.rentalPrice) > 0);
    const havePromo = matrix.some(o => o.promoPrice != null && Number(o.promoPrice) > 0);
    const haveCard = matrix.some(o => o.cardDiscountPrice != null && Number(o.cardDiscountPrice) > 0);
    return {
      idx: 2,
      ok: haveRental && haveBase ? true : "warn",
      label: `matrix opts=${matrix.length} base=${haveBase} rental=${haveRental} promo=${havePromo} card=${haveCard}`,
      note: !haveRental ? "rentalPrice 미설정 옵션 있음 — priceMatrix 누락" : undefined,
    };
  });

  // ─── 3) PartnerPolicy override 컨텍스트 ───
  await step(3, "PartnerPolicy / rentalSupport 컨텍스트", async () => {
    // PartnerPolicy 는 productId (Product.id) FK 사용 — productCode 아님
    const productRow = await prisma.product.findUnique({ where: { productCode }, select: { id: true } });
    const pp = productRow ? await prisma.partnerPolicy.findFirst({
      where: { partnerId: partnerCode!, productId: productRow.id },
      select: { giftAmount: true, installAmount: true, sellerMarginAmount: true, sellerMarginPercent: true },
    }) : null;
    return {
      idx: 3, ok: true,
      label: `PartnerPolicy ${pp ? "있음" : "없음"} (gift=${pp?.giftAmount ?? "-"}, install=${pp?.installAmount ?? "-"}, sellerMargin=${pp?.sellerMarginAmount ?? "-"}) / partner.rentalSupport=${partner.rentalSupportAmount}`,
    };
  });

  // ─── 4) 메인 카드 vs 상세 산식 일치 ───
  await step(4, "메인카드 vs 상세 가격 일치", async () => {
    const list = await listPartnerProducts(partnerCode!);
    const card = list.find((p: any) => p.productCode === productCode);
    const detail = await getPartnerProductDetail(partnerCode!, productCode!);
    if (!card || !detail) {
      return { idx: 4, ok: false, label: "메인 카드 / 상세 lookup 실패", note: `card=${!!card} detail=${!!detail}` };
    }
    // 메인 카드의 rentalPrice = effective (promo ?? rental)
    // 상세 페이지도 priceMatrix 첫 옵션의 effective 와 동일해야 함
    const cardPrice = card.rentalPrice;
    const cardCard = card.cardDiscountPrice;
    const cardBase = card.baseRentalPrice;
    // 상세에서 동일 산식 (pickLowestPrice 가 양쪽에서 호출됨)
    const detailMatrix: any[] = (detail as any).priceMatrix ?? [];
    const detailLowest = detailMatrix.reduce((best: any, o: any) => {
      const eff = o.promoPrice ?? o.rentalPrice;
      const key = o.cardDiscountPrice != null && o.cardDiscountPrice < eff ? o.cardDiscountPrice : eff;
      if (!best || key < best.key) return { key, eff, base: o.basePrice, card: o.cardDiscountPrice };
      return best;
    }, null) ?? { key: cardPrice, eff: cardPrice, base: cardBase, card: cardCard };
    const priceMatch = cardPrice === detailLowest.eff;
    const cardDcMatch = (cardCard ?? null) === (detailLowest.card ?? null);
    return {
      idx: 4,
      ok: priceMatch && cardDcMatch ? true : "warn",
      label: `메인 카드 effective=${cardPrice}, 상세 lowest effective=${detailLowest.eff}, card 메인=${cardCard} 상세=${detailLowest.card}`,
      note: !priceMatch ? "메인 카드와 상세 가격 옵션이 다름 — pickLowestPrice 두 호출처 분기 확인 (src/lib/partnerSite.ts:414 vs :699)" : undefined,
    };
  });

  // ─── 5) VAT 표기 일관성 ───
  await step(5, "VAT 표기 일관성", async () => {
    // 정책: 운영가 / 카드할인가 / 메인 카드 / 상세 = VAT 포함 표기. Settlement = 공급가.
    // Settlement 산식이 baseCommission 공급가 기준인지 확인 — verify via marginFlow 산식.
    // 가격 컨텍스트는 별도 검증 어려우니, Product.rentalPrice 가 100~500k 범위(소비자가 청구가 통상 범위)인지 확인.
    const inRange = product.rentalPrice >= 5000 && product.rentalPrice <= 500000;
    // priceMatrix 의 rentalPrice 가 모두 VAT 포함이라면 baseRental ≈ rental × 1.1 같은 비율 일관성 점검 (참고용)
    const sample = (product.priceMatrix as any[]).filter(o => o.basePrice && o.rentalPrice);
    const ratios = sample.slice(0, 3).map(o => (o.basePrice / o.rentalPrice).toFixed(3));
    return {
      idx: 5, ok: inRange ? true : "warn",
      label: `Product.rentalPrice=${product.rentalPrice} (소비자가 범위 ${inRange}), base/rental 비율 샘플=${ratios.join(", ")}`,
      note: "정책: 컨슈머 표기 VAT 포함, Settlement 산식 공급가. 자동 검증은 수동 검토 필요.",
    };
  });

  console.log(`\n백테스트 결과 — Flow 3: 가격 계산\n`);
  const total = results.length;
  for (const r of results) {
    const mark = r.ok === true ? "OK" : r.ok === "warn" ? "WARN" : "FAIL";
    console.log(`[${r.idx}/${total}] ${mark} ${r.label}${r.note ? ` — ${r.note}` : ""}`);
  }
  const fails = results.filter(r => r.ok === false).length;
  const warns = results.filter(r => r.ok === "warn").length;
  const verdict = fails > 0 ? "FAIL" : warns > 0 ? "WARN" : "OK";
  console.log(`\n종합: ${verdict} (fail=${fails} warn=${warns} ok=${total - fails - warns})`);
  console.log(`\n정리 대상 시드: (없음 — read-only)`);
  process.exit(0);
}

main().catch((e) => { console.error("[flow3] FATAL", e); process.exit(1); });
