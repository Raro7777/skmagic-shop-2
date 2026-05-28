// Backtest verifier: confirm hq-template (7 banners) push to 5 partners landed cleanly.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PARTNERS = [
  { code: "partner-03b31b", name: "지훈렌탈", expectPush: true },
  { code: "partner-4d7063", name: "우주센터", expectPush: true },
  { code: "partner-823035", name: "국민인터넷", expectPush: true },
  { code: "partner-1a2af0", name: "SK매직 우주 안드로메다점", expectPush: true },
  { code: "partner-d29bcd", name: "SK매직 무거점", expectPush: true },
  { code: "partner-7714c0", name: "인터넷끝판왕", expectPush: false },
];

async function main() {
  console.log("== DB count check ==");
  for (const p of PARTNERS) {
    const total = await prisma.banner.count({
      where: { partnerId: p.code, scope: "partner" },
    });
    const withMarker = await prisma.banner.count({
      where: {
        partnerId: p.code,
        scope: "partner",
        sourceTemplateId: "hq-template",
      },
    });
    const published = await prisma.banner.count({
      where: { partnerId: p.code, scope: "partner", status: "published" },
    });
    const flag = p.expectPush
      ? (total === 7 && withMarker === 7 ? "OK" : "WARN")
      : (total === 7 && withMarker === 0 ? "OK" : "WARN");
    console.log(
      `${flag} ${p.code} (${p.name}) total=${total} marker=${withMarker} published=${published} expectPush=${p.expectPush}`
    );
  }

  // Sample a banner title from partner-03b31b for downstream content check
  console.log("\n== Sample banner titles for partner-03b31b ==");
  const sample = await prisma.banner.findMany({
    where: { partnerId: "partner-03b31b", scope: "partner" },
    select: { id: true, title: true, status: true, priority: true, sourceTemplateId: true },
    orderBy: { priority: "desc" },
  });
  for (const b of sample) {
    console.log(
      `- priority=${b.priority} status=${b.status} marker=${b.sourceTemplateId ?? "(none)"} title=${JSON.stringify(b.title)}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
