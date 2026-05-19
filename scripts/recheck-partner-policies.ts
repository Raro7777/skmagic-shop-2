import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const all = await prisma.partnerPolicy.findMany({
    include: { product: { select: { productCode: true, name: true } } },
  });
  console.log(`총 ${all.length}건\n`);
  for (const p of all) {
    console.log(`${p.partnerId}  productId=${p.productId}  productCode=${p.product?.productCode ?? "(orphan)"}  name=${p.product?.name ?? "(orphan)"}  gift=${p.giftAmount} install=${p.installAmount}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
