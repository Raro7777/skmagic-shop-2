/** 데모 외부 API 채널 시드 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const SEEDS: Array<{ slug: string; name: string; allowedCategories: string[] }> = [
  { slug: "demo-mall",     name: "데모 제휴몰",        allowedCategories: [] },           // 전체 허용
  { slug: "water-only",    name: "정수기 전문몰 예시",  allowedCategories: ["water"] },
  { slug: "smart-home",    name: "스마트홈 제휴",      allowedCategories: ["water", "air", "bidet"] },
];

async function main() {
  for (const s of SEEDS) {
    const existing = await prisma.apiPartner.findUnique({ where: { slug: s.slug } });
    if (existing) {
      console.log(`  (skip) ${s.slug} — 이미 존재`);
      continue;
    }
    const apiKey = "rk_" + crypto.randomBytes(24).toString("base64url");
    await prisma.apiPartner.create({
      data: {
        slug: s.slug,
        name: s.name,
        apiKey,
        allowedCategories: s.allowedCategories,
        status: "active",
      },
    });
    console.log(`  ✓ ${s.slug.padEnd(15)} ${s.name}`);
    console.log(`      apiKey: ${apiKey}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
