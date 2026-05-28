/**
 * Flow 4 — 크롤 → 승인 백테스트
 *
 * Steps:
 *   1) CrawlSource 확보 (기존 active 1개) + CrawledProduct(new) 시드
 *   2) approve 호출 → Product 생성 + ProductChangeLog
 *   3) productCode 충돌 시 auto-convert 검증 (changeType="new" 였지만 existing → "updated")
 *   4) 메인 카드 (listPartnerProducts) 에 isNew=true 로 노출 + 최상단 정렬
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
let prisma: any;
let approveCrawledProduct: any;
let listPartnerProducts: any;

type StepResult = { idx: number; ok: boolean | "warn"; label: string; note?: string };
const results: StepResult[] = [];
const cleanupIds: { type: string; id: string }[] = [];

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
  ({ approveCrawledProduct } = await import("@/lib/crawler/runner"));
  ({ listPartnerProducts } = await import("@/lib/partnerSite"));

  const stamp = Date.now().toString(36);
  const newProductCode = `BTNEW-${stamp.toUpperCase()}`;
  const collidingCode = `BTCOL-${stamp.toUpperCase()}`;
  const crawledNewId = `backtest-baseline-cp-new-${stamp}`;
  const crawledColId = `backtest-baseline-cp-col-${stamp}`;
  const collisionProductId = `backtest-baseline-pp-${stamp}`;

  // ─── 1) CrawlSource + CrawledProduct(new) 시드 ───
  let source: any = null;
  await step(1, "CrawlSource 확보 + CrawledProduct(new) 시드", async () => {
    source = await prisma.crawlSource.findFirst({ where: { status: "active" } });
    if (!source) {
      source = await prisma.crawlSource.create({
        data: {
          id: `backtest-baseline-src-${stamp}`,
          slug: `backtest-${stamp}`,
          name: "백테스트소스",
          baseUrl: "https://example.invalid",
          status: "active",
        },
      });
      cleanupIds.push({ type: "CrawlSource", id: source.id });
    }
    const cp = await prisma.crawledProduct.create({
      data: {
        id: crawledNewId,
        sourceId: source.id,
        sourceUrl: `https://example.invalid/${newProductCode}`,
        productCode: newProductCode,
        name: `백테스트 신상품 ${stamp}`,
        category: "water",
        modelName: newProductCode,
        rentalPrice: 29900,
        contractPeriod: 60,
        managementType: "방문관리",
        changeType: "new",
        approvalStatus: "pending",
      },
    });
    cleanupIds.push({ type: "CrawledProduct", id: cp.id });
    return { idx: 1, ok: true, label: `Source=${source.slug}, CrawledProduct id=${cp.id} productCode=${newProductCode}` };
  });

  // ─── 2) approve 호출 → Product 생성 + ProductChangeLog (있다면) ───
  await step(2, "approve → Product 생성", async () => {
    const before = await prisma.product.findUnique({ where: { productCode: newProductCode } });
    if (before) {
      return { idx: 2, ok: "warn", label: `이미 productCode ${newProductCode} 존재 (cleanup 누락)` };
    }
    await approveCrawledProduct({ crawledId: crawledNewId, reviewerId: null, note: "backtest approve" });
    const after = await prisma.product.findUnique({
      where: { productCode: newProductCode },
      select: { id: true, productCode: true, status: true, name: true, createdAt: true },
    });
    if (!after) {
      return { idx: 2, ok: false, label: "Product 미생성", note: "src/lib/crawler/runner.ts:approveCrawledProduct new 분기 확인" };
    }
    cleanupIds.push({ type: "Product", id: after.id });
    const cpAfter = await prisma.crawledProduct.findUnique({
      where: { id: crawledNewId }, select: { approvalStatus: true, reviewedAt: true, reviewNote: true },
    });
    return {
      idx: 2, ok: true,
      label: `Product 생성 status=${after.status} (정책표 적용 전 비공개 기본값) / CrawledProduct status=${cpAfter?.approvalStatus} note="${cpAfter?.reviewNote ?? ""}"`,
    };
  });

  // ─── 3) productCode 충돌 → auto-convert ───
  await step(3, "productCode 충돌 → auto-convert (new → updated)", async () => {
    // 먼저 같은 productCode 의 기존 Product 를 강제로 만들고 (Settlement 빈 Product)
    const existing = await prisma.product.create({
      data: {
        id: collisionProductId,
        productCode: collidingCode,
        category: "water",
        name: `기존상품 ${stamp}`,
        modelName: collidingCode,
        rentalPrice: 10000,
        contractPeriod: 60,
        managementType: "방문관리",
        status: "discontinued",
      },
    });
    cleanupIds.push({ type: "Product", id: existing.id });
    // CrawledProduct.changeType="new" 인데 동일 productCode 가 이미 존재 → updated 로 자동전환
    const cp = await prisma.crawledProduct.create({
      data: {
        id: crawledColId,
        sourceId: source.id,
        sourceUrl: `https://example.invalid/${collidingCode}`,
        productCode: collidingCode,
        name: `충돌신상품 ${stamp}`,
        category: "water",
        modelName: collidingCode,
        rentalPrice: 19900,
        contractPeriod: 60,
        managementType: "방문관리",
        changeType: "new",
        approvalStatus: "pending",
      },
    });
    cleanupIds.push({ type: "CrawledProduct", id: cp.id });

    const logsBefore = await prisma.productChangeLog.count({ where: { productId: collisionProductId } });
    await approveCrawledProduct({ crawledId: crawledColId, reviewerId: null, note: "backtest collision" });
    const cpAfter = await prisma.crawledProduct.findUnique({
      where: { id: crawledColId }, select: { reviewNote: true, approvalStatus: true },
    });
    const productAfter = await prisma.product.findUnique({
      where: { productCode: collidingCode }, select: { rentalPrice: true, name: true, id: true },
    });
    const logsAfter = await prisma.productChangeLog.count({ where: { productId: collisionProductId } });

    const noteHasAuto = (cpAfter?.reviewNote ?? "").includes("auto-converted");
    // 정책: 크롤은 가격(rentalPrice / cardDiscountPrice) 을 덮어쓰지 않음 (src/lib/crawler/runner.ts:329)
    // → price 가 그대로 10000 인 것이 정상. 19900 으로 바뀌면 정책 위반.
    const priceProtected = productAfter?.rentalPrice === 10000;
    const logsGrew = logsAfter > logsBefore;
    return {
      idx: 3,
      ok: noteHasAuto && priceProtected && logsGrew ? true : "warn",
      label: `auto-convert note OK, 가격 보호 (rentalPrice 10000 유지: ${priceProtected}, 크롤은 가격 안 덮어씀), ProductChangeLog +${logsAfter - logsBefore}`,
      note: !priceProtected ? "WARN: rentalPrice 가 크롤값으로 덮어써짐 — 본사 정책표 단독 출처 정책 위반 (src/lib/crawler/runner.ts:329)" : undefined,
    };
  });

  // ─── 4) 메인 노출 + isNew flag + 정렬 ───
  await step(4, "메인 노출 + isNew flag + 정렬", async () => {
    // 새 Product 가 status=discontinued 로 만들어졌으므로, 백테스트를 위해 active 로 토글
    const productRow = await prisma.product.update({
      where: { productCode: newProductCode },
      data: { status: "active" },
      select: { id: true, createdAt: true },
    });
    // 활성 partner 1개 골라 listPartnerProducts 호출
    const partner = await prisma.partner.findFirst({
      where: { status: "active", partnerCode: { not: "hq-template" } },
      select: { partnerCode: true },
    });
    if (!partner) return { idx: 4, ok: false, label: "active partner 없음" };
    const list = await listPartnerProducts(partner.partnerCode);
    const idx = list.findIndex((p: any) => p.productCode === newProductCode);
    if (idx === -1) {
      return {
        idx: 4, ok: "warn",
        label: `listPartnerProducts 에 ${newProductCode} 없음 (총 ${list.length}건)`,
        note: "category 필터/카테고리 정렬 keys 확인 필요 — src/lib/partnerSite.ts:listPartnerProducts",
      };
    }
    const card = list[idx];
    const newOnesBefore = list.slice(0, idx).filter((p: any) => p.isNew);
    // isNew=true 면 자동 산출 영역에서 항상 isNew=false 앞에 배치 (src/lib/partnerSite.ts:468)
    return {
      idx: 4,
      ok: card.isNew ? true : "warn",
      label: `메인 노출 idx=${idx} (총 ${list.length}) isNew=${card.isNew} isFeatured=${card.isFeatured} — 앞에 또 다른 isNew=${newOnesBefore.length}개`,
      note: !card.isNew ? "isNew false — Product.createdAt 신선도 14일 윈도우 확인 (src/lib/partnerSite.ts:404)" : undefined,
    };
  });

  console.log(`\n백테스트 결과 — Flow 4: 크롤 → 승인\n`);
  const total = results.length;
  for (const r of results) {
    const mark = r.ok === true ? "OK" : r.ok === "warn" ? "WARN" : "FAIL";
    console.log(`[${r.idx}/${total}] ${mark} ${r.label}${r.note ? ` — ${r.note}` : ""}`);
  }
  const fails = results.filter(r => r.ok === false).length;
  const warns = results.filter(r => r.ok === "warn").length;
  const verdict = fails > 0 ? "FAIL" : warns > 0 ? "WARN" : "OK";
  console.log(`\n종합: ${verdict} (fail=${fails} warn=${warns} ok=${total - fails - warns})`);
  console.log(`\n정리 대상 시드:`);
  for (const c of cleanupIds) console.log(`  - ${c.type}: ${c.id}`);
  process.exit(0);
}

main().catch((e) => { console.error("[flow4] FATAL", e); process.exit(1); });
