/**
 * 배너의 ctaHref 를 상품 상세 URL 로 설정.
 *   usage: npx tsx scripts/set-banner-cta.ts <bannerId> <productCode>
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const bannerId = process.argv[2];
  const productCode = process.argv[3];
  if (!bannerId || !productCode) {
    console.log("usage: set-banner-cta.ts <bannerId> <productCode>");
    process.exit(1);
  }
  const banner = await prisma.banner.findUnique({
    where: { id: bannerId },
    select: { partnerId: true, title: true, ctaHref: true },
  });
  if (!banner) { console.log("banner not found"); process.exit(1); }
  const newHref = `/p/${banner.partnerId}/products/${productCode}`;
  console.log(`기존 ctaHref: ${banner.ctaHref ?? "—"}`);
  console.log(`신규 ctaHref: ${newHref}`);
  await prisma.banner.update({ where: { id: bannerId }, data: { ctaHref: newHref, ctaLabel: "자세히 보기" } });
  console.log(`✓ "${banner.title}" 배너 ctaHref 설정 완료`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
