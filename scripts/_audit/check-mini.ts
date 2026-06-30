import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const list = await prisma.product.findMany({
    where: { OR: [
      { name: { contains: "MEGA", mode: "insensitive" } },
      { name: { contains: "메가", mode: "insensitive" } },
      { name: { contains: "mini", mode: "insensitive" } },
      { name: { contains: "미니", mode: "insensitive" } },
      { modelName: { contains: "WPUIAC50", mode: "insensitive" } },
    ] },
    select: { productCode: true, name: true, modelName: true, category: true, status: true },
  });
  for (const p of list) console.log(`${p.productCode}\t${p.modelName}\t${p.name}\t[${p.category}/${p.status}]`);
  await prisma.$disconnect();
}
main();
