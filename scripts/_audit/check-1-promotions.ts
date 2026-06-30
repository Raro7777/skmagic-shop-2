import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const promos = await prisma.partnerProductPromotion.findMany({
    orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
  });
  console.log(`[1번 DB] PartnerProductPromotion: ${promos.length} 건`);
  for (const p of promos) {
    console.log(`  - partner=${p.partnerId}  product=${p.productCode}  enabled=${p.enabled}  text="${p.badgeText}"  ${p.startsAt?.toISOString().slice(0,10) ?? "—"} ~ ${p.endsAt?.toISOString().slice(0,10) ?? "—"}`);
  }
  console.log(`\n[1번 DB] Partner: ${await prisma.partner.count()} / Product: ${await prisma.product.count()} / Lead: ${await prisma.lead.count()}`);
  await prisma.$disconnect();
}
main();
