/**
 * 일회성 마이그레이션:
 * 시드의 가짜 productCode(WPU-A700C 등)를 실제 SK매직 코드로 교체하기 전에
 * 기존 fake Product 행과 그것에 매달린 HqPolicy/PartnerPolicy를 정리한다.
 * 그 다음 seed를 다시 돌리면 새 코드로 깨끗하게 들어간다.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const FAKE_CODES = ["WPU-A700C", "WPU-M200C", "WPU-IAC302", "WPU-S210C", "BID-S17D"];

async function main() {
  // 1) Pending 크롤 큐 정리 (이전 테스트 결과)
  const pendingDel = await prisma.crawledProduct.deleteMany({
    where: { approvalStatus: "pending" },
  });
  console.log(`크롤 큐 pending ${pendingDel.count}건 정리`);

  // 2) Fake products + 정책 삭제
  const fakeProducts = await prisma.product.findMany({
    where: { productCode: { in: FAKE_CODES } },
    select: { id: true, productCode: true },
  });
  if (fakeProducts.length === 0) {
    console.log("정리 대상 fake product 없음 (이미 정리됨)");
  } else {
    const ids = fakeProducts.map(p => p.id);
    const ppDel = await prisma.partnerPolicy.deleteMany({ where: { productId: { in: ids } } });
    const hqDel = await prisma.hqPolicy.deleteMany({ where: { productId: { in: ids } } });
    const prDel = await prisma.product.deleteMany({ where: { id: { in: ids } } });
    console.log(
      `fake products 정리: PartnerPolicy ${ppDel.count}건, HqPolicy ${hqDel.count}건, Product ${prDel.count}건 삭제`,
    );
    console.log("  대상:", fakeProducts.map(p => p.productCode).join(", "));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
