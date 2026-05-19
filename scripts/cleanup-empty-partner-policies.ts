/**
 * PartnerPolicy 의 productCode 가 비어있거나 "undefined" 문자열인 오염 row 삭제.
 *
 * Dry-run 기본. 실제 적용은 --commit 옵션.
 *   npx tsx scripts/cleanup-empty-partner-policies.ts          # dry-run
 *   npx tsx scripts/cleanup-empty-partner-policies.ts --commit # 실제 삭제
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const COMMIT = process.argv.includes("--commit");

async function main() {
  console.log(COMMIT ? "🚨 COMMIT — DB 에 실제 삭제 적용\n" : "🔍 DRY-RUN — 대상만 미리보기\n");

  // 오염 기준: productCode 가 null / "" / "undefined" / "null"
  const broken = await prisma.partnerPolicy.findMany({
    where: {
      OR: [
        { productCode: "" },
        { productCode: "undefined" },
        { productCode: "null" },
      ],
    },
  });

  if (broken.length === 0) {
    console.log("오염 row 없음 — 깨끗합니다.");
    return;
  }

  console.log(`대상 ${broken.length}건:\n`);
  for (const p of broken) {
    console.log(`  id=${p.id}  partnerId=${p.partnerId}  productCode="${p.productCode}"  gift=${p.giftAmount}  install=${p.installAmount}`);
  }

  if (COMMIT) {
    const result = await prisma.partnerPolicy.deleteMany({
      where: {
        OR: [
          { productCode: "" },
          { productCode: "undefined" },
          { productCode: "null" },
        ],
      },
    });
    console.log(`\n✓ 삭제 완료 — ${result.count}건`);
  } else {
    console.log("\n실제 적용:\n  npx tsx scripts/cleanup-empty-partner-policies.ts --commit");
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
