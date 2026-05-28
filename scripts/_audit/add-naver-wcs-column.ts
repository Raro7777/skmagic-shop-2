/**
 * Partner.naverWcsId nullable text 컬럼 추가 + 인터넷끝판왕에 wa 값 채움.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("▶ Partner.naverWcsId 컬럼 추가");

  // 컬럼 존재 여부 확인
  const exists = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM information_schema.columns
    WHERE table_name='Partner' AND column_name='naverWcsId';
  `;
  if (Number(exists[0]?.count ?? 0) === 0) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN "naverWcsId" text NULL;`);
    console.log(`  ✅ 컬럼 추가 완료`);
  } else {
    console.log(`  ℹ 컬럼 이미 존재 — skip`);
  }

  // 인터넷끝판왕 wa 값 채움
  const r = await prisma.partner.update({
    where: { partnerCode: "partner-7714c0" },
    data: { naverWcsId: "s_454608eb0263" },
    select: { partnerCode: true, partnerName: true, naverWcsId: true },
  });
  console.log(`\n✅ ${r.partnerName} (${r.partnerCode}) — naverWcsId="${r.naverWcsId}"`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
