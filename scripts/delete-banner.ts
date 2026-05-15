/**
 * 협력점 배너 직접 삭제 (관리자 토큰 우회용).
 *   usage: npx tsx scripts/delete-banner.ts <id>
 *   id 미지정 시 partner-7714c0 의 첫 번째 active 배너를 삭제.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const id = process.argv[2];
  let target;
  if (id) {
    target = await prisma.banner.findUnique({ where: { id }, select: { id: true, title: true, partnerId: true } });
  } else {
    target = await prisma.banner.findFirst({
      where: { partnerId: "partner-7714c0" },
      select: { id: true, title: true, partnerId: true },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!target) { console.log("배너 없음"); process.exit(0); }
  console.log(`삭제 대상: ${target.id} | partner=${target.partnerId} | "${target.title}"`);
  await prisma.banner.delete({ where: { id: target.id } });
  console.log("✓ 삭제 완료");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
