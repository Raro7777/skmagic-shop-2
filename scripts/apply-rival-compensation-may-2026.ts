/**
 * SK매직 26년 5월 전사 프로모션 — 타사보상 가격 적용.
 *
 * 데이터 원본: /Users/woozoo/.cokacdir/workspace/obnqnoho/26년 5월 전사 프로모션 운영 - 배포용 (1).pdf
 *   별첨 "타사보상 가격" 표 (신규, 단품 only)
 *
 * 적용 방법: Product.priceMatrix JSON 의 각 옵션에 아래 필드 추가
 *   - rivalCompensationPrice         (타사 전환 시 적용 렌탈료)
 *   - rivalCompensationHalfPriceMonths (반값할인 개월수, 없으면 null)
 *
 * 카드할인은 이 가격과 **별개**로 적용 — 본사 정책상.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

type Row = { months: number; price: number; halfPriceMonths?: number };
type Group = { 방문: Row[]; 셀프: Row[] };

// PDF 별첨 타사보상 가격 (3년=36월, 5년=60월, 6년=72월, 7년=84월)
const RIVAL_BY_PREFIX: Record<string, Group> = {
  // 얼음 카테고리
  WPUIAC425: { // 원코크 플러스 얼음물 (PSG 포함)
    방문: [{ months: 36, price: 47500 }, { months: 60, price: 42500 }, { months: 72, price: 41000 }],
    셀프: [{ months: 36, price: 45500 }, { months: 60, price: 40500 }, { months: 72, price: 39000 }],
  },
  WPUIAC414: { // 원코크 얼음물
    방문: [{ months: 36, price: 48900 }, { months: 60, price: 42900, halfPriceMonths: 3 }, { months: 72, price: 41400, halfPriceMonths: 3 }],
    셀프: [{ months: 36, price: 46900 }, { months: 60, price: 40900, halfPriceMonths: 3 }, { months: 72, price: 39400, halfPriceMonths: 3 }],
  },
  WPUIAC506: { // 메가 아이스 (신규)
    방문: [{ months: 36, price: 48500 }, { months: 60, price: 46000 }, { months: 72, price: 45000 }, { months: 84, price: 43500 }],
    셀프: [{ months: 36, price: 46500 }, { months: 60, price: 44000 }, { months: 72, price: 43000 }, { months: 84, price: 41500 }],
  },
  // 직수 카테고리
  WPUMAC306: { // 투워터 (신규)
    방문: [{ months: 36, price: 41900 }, { months: 60, price: 39900 }, { months: 72, price: 38900 }],
    셀프: [{ months: 36, price: 38900 }, { months: 60, price: 36900 }, { months: 72, price: 35900 }],
  },
  WPUJAC115: { // 초소형 플러스 (PSG 포함)
    방문: [{ months: 36, price: 34900 }, { months: 60, price: 30900 }, { months: 72, price: 29400 }, { months: 84, price: 27900 }],
    셀프: [{ months: 36, price: 31900 }, { months: 60, price: 27900 }, { months: 72, price: 26400 }, { months: 84, price: 24900 }],
  },
  WPUJAC104: { // 초소형 직수 (PSG/위글 포함)
    방문: [{ months: 36, price: 38000 }, { months: 60, price: 32000, halfPriceMonths: 3 }, { months: 72, price: 30500, halfPriceMonths: 3 }, { months: 84, price: 29000, halfPriceMonths: 3 }],
    셀프: [{ months: 36, price: 35000 }, { months: 60, price: 29000, halfPriceMonths: 3 }, { months: 72, price: 27500, halfPriceMonths: 3 }, { months: 84, price: 26000, halfPriceMonths: 3 }],
  },
  WPUJCC104: { // 초소형 직수 (다른 prefix — 동일 가격 적용)
    방문: [{ months: 36, price: 38000 }, { months: 60, price: 32000, halfPriceMonths: 3 }, { months: 72, price: 30500, halfPriceMonths: 3 }, { months: 84, price: 29000, halfPriceMonths: 3 }],
    셀프: [{ months: 36, price: 35000 }, { months: 60, price: 29000, halfPriceMonths: 3 }, { months: 72, price: 27500, halfPriceMonths: 3 }, { months: 84, price: 26000, halfPriceMonths: 3 }],
  },
  WPUJAC125: { // 초소형 라이트
    방문: [{ months: 36, price: 35000 }, { months: 60, price: 30000, halfPriceMonths: 3 }, { months: 72, price: 28500, halfPriceMonths: 3 }, { months: 84, price: 27000, halfPriceMonths: 3 }],
    셀프: [{ months: 36, price: 32000 }, { months: 60, price: 27000, halfPriceMonths: 3 }, { months: 72, price: 25500, halfPriceMonths: 3 }, { months: 84, price: 24000, halfPriceMonths: 3 }],
  },
  WPUPBC204: { // 뉴미니
    방문: [{ months: 60, price: 17900 }, { months: 72, price: 16900 }],
    셀프: [{ months: 60, price: 14900 }, { months: 72, price: 13900 }],
  },
};

type PriceOpt = {
  mode: "방문형" | "셀프형" | null;
  contractPeriod: number;
  rentalPrice?: number | null;
  cardDiscountPrice?: number | null;
  baseCommission?: number | null;
  visitInterval?: string;
  ownershipPeriod?: number | null;
  variantLabel?: string;
  rivalCompensationPrice?: number | null;
  rivalCompensationHalfPriceMonths?: number | null;
};

function pickPrefix(productCode: string): string | null {
  for (const prefix of Object.keys(RIVAL_BY_PREFIX)) {
    if (productCode.startsWith(prefix)) return prefix;
  }
  return null;
}

function findRow(group: Group, mode: "방문형" | "셀프형" | null, months: number): Row | undefined {
  const list = mode === "셀프형" ? group.셀프 : group.방문; // 모드 null 일 땐 방문 디폴트
  return list.find(r => r.months === months);
}

async function main() {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: { id: true, productCode: true, name: true, priceMatrix: true },
  });

  let touchedProducts = 0;
  let totalOptions = 0;
  let withRival = 0;
  const sampleHits: Array<{ code: string; name: string; updates: number }> = [];

  for (const p of products) {
    const prefix = pickPrefix(p.productCode);
    if (!prefix) continue;
    const group = RIVAL_BY_PREFIX[prefix];

    const matrix = (p.priceMatrix as unknown as PriceOpt[]) ?? [];
    if (!Array.isArray(matrix) || matrix.length === 0) continue;

    let localUpdates = 0;
    const next: PriceOpt[] = matrix.map(o => {
      const row = findRow(group, o.mode, o.contractPeriod);
      if (!row) return o;
      localUpdates++;
      return {
        ...o,
        rivalCompensationPrice: row.price,
        rivalCompensationHalfPriceMonths: row.halfPriceMonths ?? null,
      };
    });

    if (localUpdates === 0) continue;

    await prisma.product.update({
      where: { id: p.id },
      data: { priceMatrix: next as never },
    });
    touchedProducts++;
    totalOptions += matrix.length;
    withRival += localUpdates;
    sampleHits.push({ code: p.productCode, name: p.name, updates: localUpdates });
  }

  console.log(`📋 타사보상 가격 적용 결과`);
  console.log(`  대상 productCode prefix : ${Object.keys(RIVAL_BY_PREFIX).length}개`);
  console.log(`  적용된 Product           : ${touchedProducts}개`);
  console.log(`  옵션 갱신 합계            : ${withRival}건 (전체 옵션 ${totalOptions}건)`);
  console.log(`\n샘플:`);
  for (const s of sampleHits.slice(0, 15)) {
    console.log(`  ${s.code}  ${s.name.padEnd(30)}  +${s.updates}건`);
  }
  if (sampleHits.length > 15) console.log(`  ... +${sampleHits.length - 15}개 더`);

  // 검증 — 적용된 한 상품의 priceMatrix 발췌
  if (sampleHits[0]) {
    const sample = await prisma.product.findFirst({
      where: { productCode: sampleHits[0].code },
      select: { productCode: true, name: true, priceMatrix: true },
    });
    const opts = sample?.priceMatrix as unknown as PriceOpt[] | null;
    if (opts) {
      console.log(`\n[검증] ${sample!.productCode} ${sample!.name}`);
      for (const o of opts) {
        const rp = o.rivalCompensationPrice ?? "—";
        const half = o.rivalCompensationHalfPriceMonths ? ` (${o.rivalCompensationHalfPriceMonths}개월 반값)` : "";
        console.log(`  ${(o.mode ?? "단일").padEnd(6)} ${o.contractPeriod}개월 → 일반 ${o.rentalPrice}원 / 타사보상 ${rp}${half}`);
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
