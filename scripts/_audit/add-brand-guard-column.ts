/**
 * Partner.brandGuardVideoUrl 컬럼 추가 + partner-7714c0 (우성종합통신) 에 값 설정.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 컬럼 존재 여부 검사
  const exists = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM information_schema.columns
    WHERE table_name='Partner' AND column_name='brandGuardVideoUrl';
  `;
  if (Number(exists[0]?.count ?? 0) === 0) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN "brandGuardVideoUrl" text NULL;`);
    console.log("✅ 컬럼 추가 완료");
  } else {
    console.log("ℹ 컬럼 이미 존재");
  }

  const r = await prisma.partner.update({
    where: { partnerCode: "partner-7714c0" },
    data: { brandGuardVideoUrl: "/sk-magic-brand-guard.mp4" },
    select: { partnerCode: true, partnerName: true, brandGuardVideoUrl: true },
  });
  console.log(`✅ ${r.partnerName} (${r.partnerCode}) — brandGuardVideoUrl="${r.brandGuardVideoUrl}"`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
