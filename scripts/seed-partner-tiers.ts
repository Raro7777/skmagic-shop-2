/** 협력점 8곳에 tier 다양성 부여 (시연용). */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const TIER_BY_PARTNER: Record<string, "basic" | "standard" | "premium" | "enterprise"> = {
  "gangnam-skmagic":  "premium",      // 강남 — 영업자 3명, 활동 활발 → premium
  "jamsil-skmagic":   "standard",
  "bucheon-skmagic":  "standard",
  "bundang-rental":   "basic",
  "suwon-life":       "standard",
  "incheon-life":     "premium",
  "gwangju-hq":       "enterprise",   // 광주 — 본부점 → 최상위
  "daejeon-mid":      "standard",
};

async function main() {
  let touched = 0;
  for (const [code, tier] of Object.entries(TIER_BY_PARTNER)) {
    const partner = await prisma.partner.findUnique({ where: { partnerCode: code } });
    if (!partner) continue;
    await prisma.partner.update({
      where: { partnerCode: code },
      data: { tier },
    });
    console.log(`  ${partner.partnerName.padEnd(22)} → ${tier}`);
    touched++;
  }
  console.log(`\n✅ ${touched}곳 tier 적용 완료`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
