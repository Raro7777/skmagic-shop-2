/**
 * Seller 푸터 override 필드 일괄 추가.
 * 미설정(null) 시 협력점 값으로 폴백 — partnerSite.ts 측 로직.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
if (!url) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const COLUMNS: Array<[string, string]> = [
  ["companyName", "TEXT"],     // 상호
  ["ownerName", "TEXT"],       // 대표자
  ["address", "TEXT"],
  ["businessNumber", "TEXT"],
  ["commerceNumber", "TEXT"],
  ["hotlineNumber", "TEXT"],
  ["csHours", "TEXT"],
  ["csLunchHours", "TEXT"],
  ["csHolidays", "TEXT"],
  ["kakaoChannelUrl", "TEXT"],
  ["footerLogoUrl", "TEXT"],
];

async function main() {
  for (const [name, type] of COLUMNS) {
    console.log(`▶ Seller.${name}`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Seller' AND column_name = ANY($1::text[])`,
    COLUMNS.map(c => c[0]),
  );
  console.log("✅ 추가된 컬럼:", rows.map(r => r.column_name).join(", "));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
