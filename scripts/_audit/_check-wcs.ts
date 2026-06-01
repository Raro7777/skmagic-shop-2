import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client"; import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const partners = await prisma.partner.findMany({
    select: { partnerCode: true, partnerName: true, naverWcsId: true, customDomain: true, customDomainStatus: true },
  });
  for (const p of partners) {
    console.log(`${p.partnerName} (${p.partnerCode}) wa="${p.naverWcsId ?? "(null)"}" domain="${p.customDomain ?? "—"}" status=${p.customDomainStatus ?? "—"}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
