import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
async function main() {
  const { prisma } = await import("@/lib/prisma");
  // Delete in dependency order
  const settlementRows = await prisma.settlement.findMany({
    where: { leadId: { startsWith: "backtest-baseline-" } }, select: { id: true, leadId: true },
  });
  if (settlementRows.length) {
    await prisma.settlement.deleteMany({ where: { leadId: { startsWith: "backtest-baseline-" } } });
    console.log(`Settlement deleted: ${settlementRows.length}`);
  }
  const logs = await prisma.leadStatusLog.deleteMany({ where: { leadId: { startsWith: "backtest-baseline-" } } });
  console.log(`LeadStatusLog deleted: ${logs.count}`);
  const leads = await prisma.lead.deleteMany({ where: { id: { startsWith: "backtest-baseline-" } } });
  console.log(`Lead deleted: ${leads.count}`);
  const reqs = await prisma.approvalRequest.deleteMany({ where: { id: { startsWith: "backtest-baseline-" } } });
  console.log(`ApprovalRequest deleted: ${reqs.count}`);
  // Banners + PartnerPolicies for backtest partners
  const partners = await prisma.partner.findMany({ where: { partnerCode: { startsWith: "backtest-baseline-" } }, select: { partnerCode: true } });
  for (const p of partners) {
    await prisma.banner.deleteMany({ where: { partnerId: p.partnerCode } });
    await prisma.partnerPolicy.deleteMany({ where: { partnerId: p.partnerCode } });
  }
  const partnersDel = await prisma.partner.deleteMany({ where: { partnerCode: { startsWith: "backtest-baseline-" } } });
  console.log(`Partner deleted: ${partnersDel.count}`);
  // Products + ProductChangeLog: by code prefix BTNEW- / BTCOL-
  const btProducts = await prisma.product.findMany({
    where: { OR: [{ productCode: { startsWith: "BTNEW-" } }, { productCode: { startsWith: "BTCOL-" } }] },
    select: { id: true, productCode: true },
  });
  for (const p of btProducts) {
    await prisma.productChangeLog.deleteMany({ where: { productId: p.id } });
    await prisma.partnerPolicy.deleteMany({ where: { productId: p.id } });
  }
  const prodDel = await prisma.product.deleteMany({
    where: { OR: [{ productCode: { startsWith: "BTNEW-" } }, { productCode: { startsWith: "BTCOL-" } }] },
  });
  console.log(`Product deleted: ${prodDel.count}`);
  const crawledDel = await prisma.crawledProduct.deleteMany({ where: { id: { startsWith: "backtest-baseline-" } } });
  console.log(`CrawledProduct deleted: ${crawledDel.count}`);
  const sourceDel = await prisma.crawlSource.deleteMany({ where: { id: { startsWith: "backtest-baseline-" } } });
  console.log(`CrawlSource deleted: ${sourceDel.count}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
