import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// 엑셀 rows 27/37/47에서 직접 옮긴 셀프형 60개월 옵션
const PATCHES: Record<string, {
  variantLabel: string;
  rentalPrice: number;
  cardDiscountPrice: number;
  baseCommission: number;
}> = {
  ACL15C1ASKWH: { variantLabel: "* 셀프형 * | 크림베이지", rentalPrice: 23900, cardDiscountPrice: 19900, baseCommission: 167500 },
  ACL20C1ASKWH: { variantLabel: "* 셀프형 * | 화이트", rentalPrice: 25900, cardDiscountPrice: 21900, baseCommission: 227400 },
  ACL25C1ASKCE: { variantLabel: "* 셀프형 * | 크림베이지", rentalPrice: 29900, cardDiscountPrice: 25900, baseCommission: 245700 },
};

type PriceOption = {
  mode: "방문형" | "셀프형" | null;
  variantLabel?: string;
  contractPeriod: number;
  ownershipPeriod: number | null;
  visitInterval: string;
  rentalPrice: number | null;
  cardDiscountPrice: number | null;
  baseCommission: number | null;
};

async function main() {
  for (const [code, patch] of Object.entries(PATCHES)) {
    const p = await prisma.product.findUnique({
      where: { productCode: code },
      select: { id: true, productCode: true, name: true, priceMatrix: true },
    });
    if (!p) { console.log(`! ${code} not found`); continue; }

    const matrix: PriceOption[] = (p.priceMatrix as unknown as PriceOption[] | null) ?? [];
    const already = matrix.find(o => o.mode === "셀프형" && o.contractPeriod === 60);
    if (already) {
      console.log(`= ${code} already has 셀프형 60 — skip`);
      continue;
    }

    const newOpt: PriceOption = {
      mode: "셀프형",
      variantLabel: patch.variantLabel,
      contractPeriod: 60,
      ownershipPeriod: 60,
      visitInterval: "12개월",
      rentalPrice: patch.rentalPrice,
      cardDiscountPrice: patch.cardDiscountPrice,
      baseCommission: patch.baseCommission,
    };

    // 셀프형 그룹 안에서 약정기간 순서 유지 — 36/48/60/72/84
    const before = matrix.filter(o => !(o.mode === "셀프형" && o.contractPeriod > 60));
    const after = matrix.filter(o => o.mode === "셀프형" && o.contractPeriod > 60);
    const updated = [...before, newOpt, ...after];

    await prisma.product.update({
      where: { id: p.id },
      data: { priceMatrix: updated as never },
    });
    console.log(`+ ${code} (${p.name}): 셀프형 60개월 추가 (rent=${patch.rentalPrice}, card=${patch.cardDiscountPrice}, base=${patch.baseCommission})`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
