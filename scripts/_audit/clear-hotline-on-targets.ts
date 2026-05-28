/**
 * P0 #20 조치 — 지훈렌탈/SK매직 무거점 hotlineNumber 의 본사 핫라인(1600-2434) 즉시 제거.
 * Partner.hotlineNumber 는 NOT NULL with default("1600-2434") 이므로 빈 문자열("")로 설정해
 * PartnerFooter / PartnerCta 의 가드가 자연스럽게 hide 처리하도록 함.
 *
 * 사용자가 실제 핫라인을 알려주면 그 값으로 갱신 (별도).
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const TARGETS = ["partner-03b31b", "partner-d29bcd"];
const HQ_HOTLINE = "1600-2434";

async function main() {
  console.log("▶ P0 #20 footer 핫라인 즉시 제거\n");

  for (const code of TARGETS) {
    const before = await prisma.partner.findUnique({
      where: { partnerCode: code },
      select: { partnerCode: true, partnerName: true, hotlineNumber: true },
    });
    if (!before) { console.log(`  ⚠ ${code} 없음 — skip`); continue; }

    if (before.hotlineNumber !== HQ_HOTLINE) {
      console.log(`  - ${before.partnerName} (${code}): 이미 다른 값(${before.hotlineNumber}) — skip`);
      continue;
    }

    const after = await prisma.partner.update({
      where: { partnerCode: code },
      data: { hotlineNumber: "" },
      select: { partnerCode: true, partnerName: true, hotlineNumber: true },
    });
    console.log(`  ✅ ${after.partnerName} (${code}): "${before.hotlineNumber}" → "" (빈값)`);
  }

  console.log("\n검증:");
  const after = await prisma.partner.findMany({
    where: { partnerCode: { in: TARGETS } },
    select: { partnerCode: true, partnerName: true, hotlineNumber: true },
  });
  for (const p of after) {
    const flag = p.hotlineNumber === HQ_HOTLINE ? "❌ 여전히 본사 핫라인" : "✅ 본사 핫라인 아님";
    console.log(`  ${p.partnerName}: hotlineNumber="${p.hotlineNumber}" — ${flag}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
