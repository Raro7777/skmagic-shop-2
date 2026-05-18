import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const banners = await prisma.banner.findMany({
    select: { id: true, partnerId: true, title: true, layout: true, ctaHref: true, ctaLabel: true, status: true, imageUrl: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`총 ${banners.length}건`);
  for (const b of banners) {
    console.log(`  ${b.id} | partner=${b.partnerId} | "${b.title}" | layout=${b.layout} | status=${b.status}`);
    console.log(`     ctaLabel=${b.ctaLabel ?? "—"} ctaHref=${b.ctaHref ?? "—"}`);
    console.log(`     imageUrl=${b.imageUrl ? "(set)" : "—"} createdAt=${b.createdAt.toISOString().slice(0, 16)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
