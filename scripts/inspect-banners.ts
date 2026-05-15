import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const banners = await prisma.banner.findMany({
    select: { id: true, partnerId: true, title: true, status: true, layout: true, sourceTemplateId: true, startsAt: true, endsAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`총 배너: ${banners.length}건`);
  for (const b of banners) {
    console.log(`  ${b.id} | partner=${b.partnerId} | "${b.title}" | ${b.status} | ${b.layout} | tmpl=${b.sourceTemplateId ?? "—"} | ${b.startsAt.toISOString().slice(0, 10)}~${b.endsAt.toISOString().slice(0, 10)} | created=${b.createdAt.toISOString().slice(0, 10)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
