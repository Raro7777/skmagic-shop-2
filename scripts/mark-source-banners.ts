/**
 * 인터넷끝판왕(partner-7714c0) 자체 배너 7개에 sourceTemplateId='hq-template' 마커 부착.
 * 이렇게 해두면 push-template-to-partners 시 자기 자신은 자동 스킵됨.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SOURCE = "partner-7714c0";
const MARKER = "hq-template";

async function main() {
  const before = await prisma.banner.findMany({
    where: { partnerId: SOURCE, scope: "partner" },
    select: { id: true, title: true, sourceTemplateId: true },
  });
  console.log(`▶ ${SOURCE} 배너 ${before.length}개`);
  for (const b of before) {
    console.log(`   - "${b.title}" sourceTemplateId=${b.sourceTemplateId ?? "(null)"}`);
  }

  const r = await prisma.banner.updateMany({
    where: {
      partnerId: SOURCE,
      scope: "partner",
      OR: [
        { sourceTemplateId: null },
        { sourceTemplateId: { not: MARKER } },
      ],
    },
    data: { sourceTemplateId: MARKER },
  });
  console.log(`\n✅ ${r.count}개 배너에 sourceTemplateId='${MARKER}' 마커 부착`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
