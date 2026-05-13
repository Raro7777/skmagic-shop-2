import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const KEEP = "partner-7714c0";

async function main() {
  console.log(`=== 보존 대상: ${KEEP} (인터넷끝판왕) ===\n`);

  const partners = await prisma.partner.findMany({
    select: {
      partnerCode: true, partnerName: true, status: true, createdAt: true,
      _count: { select: { leads: true, sellers: true, settlements: true, users: true, banners: true, policies: true, approvals: true, reviews: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Partners: ${partners.length}개`);
  for (const p of partners) {
    const mark = p.partnerCode === KEEP ? " ★ KEEP" : " 🗑";
    console.log(`  ${mark}  ${p.partnerCode}  ${p.partnerName}  ${p.status}  · leads=${p._count.leads}, sellers=${p._count.sellers}, users=${p._count.users}, settlements=${p._count.settlements}`);
  }
  console.log("");
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, partnerId: true },
  });
  console.log(`Users: ${users.length}명`);
  const hqUsers = users.filter(u => u.role === "hq");
  const partnerUsers = users.filter(u => u.role === "partner_admin");
  const sellerUsers = users.filter(u => u.role === "seller");
  console.log(`  hq=${hqUsers.length}, partner_admin=${partnerUsers.length}, seller=${sellerUsers.length}`);
  for (const u of hqUsers) console.log(`  ★ hq: ${u.email ?? u.name} (id=${u.id})`);

  console.log("");
  const intkingLeads = await prisma.lead.count({ where: { partnerId: KEEP } });
  const intkingSellers = await prisma.seller.count({ where: { partnerId: KEEP } });
  const intkingSettlements = await prisma.settlement.count({ where: { partnerId: KEEP } });
  console.log(`인터넷끝판왕 관련: leads=${intkingLeads}, sellers=${intkingSellers}, settlements=${intkingSettlements}`);

  console.log("");
  const hqPoolLeads = await prisma.lead.count({ where: { partnerId: null } });
  console.log(`hq_pool leads (partnerId=null): ${hqPoolLeads}개`);
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
