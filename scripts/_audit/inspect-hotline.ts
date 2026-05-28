/**
 * P0 #20 조치 — 지훈렌탈 / SK매직 무거점 hotline 필드 + 분양 신청서 원본 확인
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const TARGETS = ["partner-03b31b", "partner-d29bcd"];

async function main() {
  for (const code of TARGETS) {
    const p = await prisma.partner.findUnique({ where: { partnerCode: code } });
    if (!p) { console.log(`${code} 없음`); continue; }
    console.log(`\n=== ${p.partnerName} (${code}) ===`);
    console.log(`  hotlineNumber       = ${p.hotlineNumber}`);
    console.log(`  businessNumber      = ${p.businessNumber}`);
    console.log(`  representativeName  = ${p.representativeName}`);
    console.log(`  region              = ${p.region}`);
    console.log(`  brandLabel          = ${p.brandLabel}`);
    console.log(`  commerceNumber      = ${p.commerceNumber ?? "(null)"}`);
    console.log(`  address             = ${p.address ?? "(null)"}`);

    // 분양 신청서 원본
    const req = await prisma.approvalRequest.findFirst({
      where: { kind: "partner_signup", partnerId: code },
      orderBy: { createdAt: "desc" },
    });
    if (req?.applicationData) {
      console.log(`\n  분양 신청서 원본 (applicationData):`);
      const data = req.applicationData as Record<string, unknown>;
      for (const key of Object.keys(data)) {
        const v = data[key];
        const short = typeof v === "string" ? v.slice(0, 80) : JSON.stringify(v);
        console.log(`    - ${key}: ${short}`);
      }
    } else {
      console.log(`  (분양 신청서 applicationData 없음)`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
