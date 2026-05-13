import { prisma } from "../src/lib/prisma";

type PriceOption = {
  mode: "방문형" | "셀프형" | null;
  contractPeriod: number;
  visitInterval?: string;
  rentalPrice?: number;
};

async function main() {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: { productCode: true, name: true, category: true, priceMatrix: true },
  });

  const missingSelf60: Array<{ code: string; name: string; modes: string[]; periodsInSelf: number[] }> = [];
  const noPriceMatrix: string[] = [];
  let totalActive = 0;
  let hasSelfMode = 0;

  for (const p of products) {
    totalActive++;
    const matrix = (p.priceMatrix as unknown as PriceOption[] | null) ?? [];
    if (matrix.length === 0) { noPriceMatrix.push(`${p.productCode} (${p.name})`); continue; }

    const modes = Array.from(new Set(matrix.map(o => o.mode ?? "null")));
    const selfOpts = matrix.filter(o => o.mode === "셀프형");
    if (selfOpts.length === 0) continue;

    hasSelfMode++;
    const periodsInSelf = Array.from(new Set(selfOpts.map(o => o.contractPeriod))).sort((a, b) => a - b);
    if (!periodsInSelf.includes(60)) {
      missingSelf60.push({ code: p.productCode, name: p.name, modes, periodsInSelf });
    }
  }

  console.log(`Active 상품 ${totalActive}개 · 셀프형 옵션 보유 ${hasSelfMode}개`);
  console.log(`priceMatrix 비어있는 상품 ${noPriceMatrix.length}개`);
  if (noPriceMatrix.length > 0 && noPriceMatrix.length <= 30) noPriceMatrix.forEach(c => console.log(`  · ${c}`));
  console.log();
  console.log(`셀프형 60개월 누락 상품 ${missingSelf60.length}개:`);
  for (const m of missingSelf60) {
    console.log(`  ${m.code} (${m.name})`);
    console.log(`    셀프형 현재 약정 옵션: [${m.periodsInSelf.join(", ")}]`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
