import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const KEEP = "partner-7714c0";
const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  // 삭제 대상 partner 코드
  const targets = await prisma.partner.findMany({
    where: { partnerCode: { not: KEEP } },
    select: { partnerCode: true, partnerName: true },
  });
  const codes = targets.map(t => t.partnerCode);

  // hq pool lead (partnerId=null) 도 함께 삭제
  const settlementCount = await prisma.settlement.count({
    where: { partnerId: { in: codes } },
  });
  const leadCount = await prisma.lead.count({
    where: { OR: [{ partnerId: { in: codes } }, { partnerId: null }] },
  });
  const sellerCount = await prisma.seller.count({ where: { partnerId: { in: codes } } });
  const bannerCount = await prisma.banner.count({ where: { partnerId: { in: codes } } });
  const approvalCount = await prisma.approvalRequest.count({ where: { partnerId: { in: codes } } });
  const policyCount = await prisma.partnerPolicy.count({ where: { partnerId: { in: codes } } });
  const reviewCount = await prisma.review.count({ where: { partnerId: { in: codes } } });
  const userCount = await prisma.user.count({ where: { OR: [
    { partnerId: { in: codes } },
    { email: "hq@rentking.kr" },
  ] } });

  console.log(`삭제 대상 요약:`);
  console.log(`  Partners: ${codes.length}개`);
  console.log(`  Settlements: ${settlementCount}`);
  console.log(`  Leads (협력점 + hq_pool): ${leadCount}`);
  console.log(`  Sellers: ${sellerCount}`);
  console.log(`  Banners: ${bannerCount}`);
  console.log(`  ApprovalRequests: ${approvalCount}`);
  console.log(`  PartnerPolicies: ${policyCount}`);
  console.log(`  Reviews: ${reviewCount}`);
  console.log(`  Users (협력점 + hq@rentking.kr): ${userCount}`);

  if (!APPLY) {
    console.log("\nℹ︎ dry-run. --apply 인자로 실제 삭제 진행.");
    return;
  }

  console.log("\n--- 실제 삭제 진행 ---");
  const result = await prisma.$transaction([
    prisma.settlement.deleteMany({ where: { partnerId: { in: codes } } }),
    prisma.lead.deleteMany({ where: { OR: [{ partnerId: { in: codes } }, { partnerId: null }] } }),
    prisma.seller.deleteMany({ where: { partnerId: { in: codes } } }),
    prisma.banner.deleteMany({ where: { partnerId: { in: codes } } }),
    prisma.approvalRequest.deleteMany({ where: { partnerId: { in: codes } } }),
    prisma.partnerPolicy.deleteMany({ where: { partnerId: { in: codes } } }),
    prisma.review.deleteMany({ where: { partnerId: { in: codes } } }),
    prisma.user.deleteMany({ where: { OR: [
      { partnerId: { in: codes } },
      { email: "hq@rentking.kr" },
    ] } }),
    prisma.partner.deleteMany({ where: { partnerCode: { in: codes } } }),
  ]);
  console.log(`✓ settlement: ${result[0].count}`);
  console.log(`✓ lead (cascade: enrollmentForm + leadStatusLog): ${result[1].count}`);
  console.log(`✓ seller: ${result[2].count}`);
  console.log(`✓ banner: ${result[3].count}`);
  console.log(`✓ approvalRequest: ${result[4].count}`);
  console.log(`✓ partnerPolicy: ${result[5].count}`);
  console.log(`✓ review: ${result[6].count}`);
  console.log(`✓ user: ${result[7].count}`);
  console.log(`✓ partner: ${result[8].count}`);
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
