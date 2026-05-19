/**
 * LiveActivity 의 region 을 시·구 단위로 분산.
 *
 * 기존: 서울 강남/서초/송파 등만 반복 → 부자연스러움.
 * 변경: 시흥시 / 부천시 / 광명시 / 안산시 / 수원시 / 천안시 / 인천 부평구 / 의정부시 등
 *       시·구 단위로 골고루. priority 순서대로 슬롯 매핑.
 *
 * customerName / status / minutesAgo / priority 는 유지 (재현성).
 *
 * --apply 없으면 dry-run.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const APPLY = process.argv.includes("--apply");

// 시·구 단위 — 강남 같은 서울 핵심 1곳은 유지, 나머지는 수도권 외곽 + 천안.
// 실제 다양한 지역에서 접수되는 느낌을 위해 8 슬롯 = 8 서로 다른 지역.
const REGIONS_BY_PRIORITY = [
  "시흥시",     // pri=100 (최상단)
  "부천시",     // pri=95
  "광명시",     // pri=90
  "수원시",     // pri=85
  "안산시",     // pri=80
  "천안시",     // pri=75
  "인천 부평구", // pri=70
  "강남구",     // pri=65 (서울 1곳 자연스럽게)
];

async function main() {
  console.log(`▶ ${APPLY ? "APPLY" : "DRY-RUN"} : LiveActivity region 시·구 단위로 분산\n`);

  const rows = await prisma.liveActivity.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  console.log(`📦 LiveActivity ${rows.length}건\n`);

  let updated = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const newRegion = REGIONS_BY_PRIORITY[i] ?? REGIONS_BY_PRIORITY[REGIONS_BY_PRIORITY.length - 1];
    if (row.region === newRegion) continue;
    console.log(`  ${row.id.slice(-6)}  ${row.customerName.padEnd(6)}  ${(row.region ?? "—").padEnd(8)} → ${newRegion}`);
    if (APPLY) {
      await prisma.liveActivity.update({ where: { id: row.id }, data: { region: newRegion } });
    }
    updated++;
  }

  console.log(`\n══ ${APPLY ? "APPLY" : "DRY-RUN"} ══`);
  console.log(`  변경: ${updated}건`);
  if (!APPLY) console.log(`\n  💡 --apply 플래그로 실제 갱신`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
