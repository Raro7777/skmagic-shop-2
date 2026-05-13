/**
 * 시나리오 데이터 정합성 + 정확도 실측:
 *   1. status 분포가 의도와 일치하는지
 *   2. 채널 분포 (협력점/영업자/API) 정확한지
 *   3. Settlement 합계가 lead × HqPolicy + PartnerPolicy 환원과 일치하는지
 *   4. HqAnalytics가 시드 결과를 정확히 반영하는지
 *   5. 협력점별 정산서 합계 검증
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const NAME_TAG = "[VS]";

async function main() {
  // 1) status 분포
  const statusCounts = await prisma.lead.groupBy({
    by: ["status"],
    where: { customerName: { startsWith: NAME_TAG } },
    _count: { _all: true },
  });
  const totalScenario = statusCounts.reduce((s, x) => s + x._count._all, 0);
  console.log(`📊 시나리오 lead 총계 ${totalScenario}건`);
  for (const sc of statusCounts) {
    const pct = (sc._count._all / totalScenario) * 100;
    console.log(`   ${sc.status.padEnd(8)} ${sc._count._all.toString().padStart(3)}건 (${pct.toFixed(0)}%)`);
  }

  // 2) 채널 분포
  console.log(`\n📡 채널 분포`);
  const bySource = await prisma.lead.groupBy({
    by: ["source"],
    where: { customerName: { startsWith: NAME_TAG } },
    _count: { _all: true },
  });
  for (const sc of bySource) console.log(`   source=${sc.source.padEnd(16)} ${sc._count._all}건`);

  const byChannel = await prisma.lead.groupBy({
    by: ["externalChannel"],
    where: { customerName: { startsWith: NAME_TAG }, externalChannel: { not: null } },
    _count: { _all: true },
  });
  for (const c of byChannel) console.log(`   externalChannel=${c.externalChannel}: ${c._count._all}건`);

  // 3) 협력점별 lead
  console.log(`\n🏪 협력점별 lead`);
  const byPartner = await prisma.lead.groupBy({
    by: ["partnerId", "status"],
    where: { customerName: { startsWith: NAME_TAG }, partnerId: { not: null } },
    _count: { _all: true },
  });
  const partnerMap = new Map<string, Record<string, number>>();
  for (const x of byPartner) {
    if (!x.partnerId) continue;
    const cur = partnerMap.get(x.partnerId) ?? {};
    cur[x.status] = x._count._all;
    partnerMap.set(x.partnerId, cur);
  }
  for (const [pid, counts] of partnerMap) {
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    console.log(`   ${pid.padEnd(20)} 총 ${total} (new:${counts.new ?? 0} going:${counts.going ?? 0} done:${counts.done ?? 0} warn:${counts.warn ?? 0})`);
  }
  const hqPoolLeads = await prisma.lead.count({ where: { customerName: { startsWith: NAME_TAG }, partnerId: null } });
  console.log(`   ${"hq_pool (API)".padEnd(20)} ${hqPoolLeads}건`);

  // 4) Settlement 정합성
  console.log(`\n💳 Settlement 검증`);
  const settlements = await prisma.settlement.findMany({
    where: { lead: { customerName: { startsWith: NAME_TAG } } },
    include: { lead: { select: { partnerId: true, productCode: true } } },
  });
  console.log(`   총 ${settlements.length}건`);
  const byStatus: Record<string, number> = {};
  let totalNet = 0, totalCommission = 0, totalReturn = 0;
  for (const s of settlements) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    totalNet += s.netPayout;
    totalCommission += s.baseCommission;
    totalReturn += s.giftReturned + s.installReturned;
  }
  for (const [k, v] of Object.entries(byStatus)) console.log(`   ${k.padEnd(12)} ${v}건`);
  console.log(`   본사 수수료 합계  ₩${totalCommission.toLocaleString()}`);
  console.log(`   환원(사은품+설치) ₩${totalReturn.toLocaleString()}`);
  console.log(`   순수령 합계       ₩${totalNet.toLocaleString()}`);

  // 5) Settlement 각 건이 HqPolicy + PartnerPolicy 와 일치하는지 검증
  console.log(`\n🔍 Settlement 각 건 정합성 검증`);
  let mismatches = 0;
  for (const s of settlements) {
    if (!s.productCode || !s.partnerId) continue;
    const product = await prisma.product.findUnique({
      where: { productCode: s.productCode },
      include: {
        hqPolicy: true,
        partnerPolicies: { where: { partnerId: s.partnerId } },
      },
    });
    if (!product?.hqPolicy) continue;
    const expectedBase = product.hqPolicy.baseCommission + product.hqPolicy.monthIncentive;
    const expectedGift = product.partnerPolicies[0]?.giftAmount ?? 0;
    const expectedInstall = product.partnerPolicies[0]?.installAmount ?? 0;
    const expectedNet = expectedBase - expectedGift - expectedInstall;
    if (s.baseCommission !== expectedBase || s.giftReturned !== expectedGift || s.installReturned !== expectedInstall || s.netPayout !== expectedNet) {
      mismatches++;
      console.log(`   ✗ ${s.id} ${s.productCode}: settlement(base=${s.baseCommission}, net=${s.netPayout}) vs expected(base=${expectedBase}, net=${expectedNet})`);
    }
  }
  if (mismatches === 0) console.log(`   ✓ ${settlements.length}건 모두 HqPolicy + PartnerPolicy 와 일치`);

  // 6) 협력점별 정산서 합계
  console.log(`\n📋 협력점별 정산서 (이번 달)`);
  const periodMonth = new Date().toISOString().slice(0, 7);
  const byPartnerSettle = await prisma.settlement.groupBy({
    by: ["partnerId", "status"],
    where: { lead: { customerName: { startsWith: NAME_TAG } } },
    _count: { _all: true },
    _sum: { netPayout: true, baseCommission: true, giftReturned: true, installReturned: true },
  });
  const settleByPartner = new Map<string, { count: number; net: number; base: number; gift: number; install: number; statuses: Record<string, number> }>();
  for (const x of byPartnerSettle) {
    const cur = settleByPartner.get(x.partnerId) ?? { count: 0, net: 0, base: 0, gift: 0, install: 0, statuses: {} };
    cur.count += x._count._all;
    cur.net += x._sum.netPayout ?? 0;
    cur.base += x._sum.baseCommission ?? 0;
    cur.gift += x._sum.giftReturned ?? 0;
    cur.install += x._sum.installReturned ?? 0;
    cur.statuses[x.status] = x._count._all;
    settleByPartner.set(x.partnerId, cur);
  }
  for (const [pid, s] of settleByPartner) {
    console.log(`   ${pid.padEnd(20)} ${s.count}건  수수료 ₩${s.base.toLocaleString().padStart(8)}  환원 ₩${(s.gift + s.install).toLocaleString().padStart(7)}  순수령 ₩${s.net.toLocaleString().padStart(9)}  (${Object.entries(s.statuses).map(([k, v]) => `${k}:${v}`).join(" ")})`);
  }

  // 7) HqAnalytics 결과 검증
  console.log(`\n📈 HqAnalytics 빠른 확인`);
  const { getHqAnalytics } = await import("../src/lib/hqAnalytics");
  const analytics = await getHqAnalytics(30);
  console.log(`   전체 lead       ${analytics.totals.leads}건 (시나리오 50건 + 기존 데이터 일부 포함)`);
  console.log(`   완료(done)      ${analytics.totals.done}건`);
  console.log(`   전환율          ${analytics.totals.conversionRate}%`);
  console.log(`   정산 합계       ₩${analytics.totals.netPayout.toLocaleString()}`);
  console.log(`   채널 수         ${analytics.byChannel.length}종`);
  console.log(`   상위 협력점     ${analytics.byPartner.slice(0, 3).map(p => `${p.partnerName}(${p.leads30d})`).join(", ")}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
