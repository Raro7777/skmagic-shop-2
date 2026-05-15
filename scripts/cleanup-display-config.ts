import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const STALE_KEYS = ["hqCampaignBannerEnabled"];

async function main() {
  const partners = await prisma.partner.findMany({
    select: { partnerCode: true, displayConfig: true },
  });
  let cleaned = 0;
  for (const p of partners) {
    const cfg = (p.displayConfig as Record<string, unknown> | null) ?? null;
    if (!cfg) continue;
    let touched = false;
    const next = { ...cfg };
    for (const k of STALE_KEYS) {
      if (k in next) { delete next[k]; touched = true; }
    }
    if (touched) {
      await prisma.partner.update({
        where: { partnerCode: p.partnerCode },
        data: { displayConfig: next as never },
      });
      cleaned++;
      console.log(`✓ ${p.partnerCode}: removed ${STALE_KEYS.join(", ")}`);
    }
  }
  console.log(`\ntotal cleaned: ${cleaned}/${partners.length}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
