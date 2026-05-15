import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const code = process.argv[2] ?? "partner-7714c0";
  const partner = await prisma.partner.findUnique({
    where: { partnerCode: code },
    select: { displayConfig: true },
  });
  if (!partner) { console.log("not found"); process.exit(1); }
  const current = (partner.displayConfig as object | null) ?? {};
  const next = { ...current, heroAutoSlidesEnabled: false };
  await prisma.partner.update({
    where: { partnerCode: code },
    data: { displayConfig: next as never },
  });
  console.log(`✓ ${code}.displayConfig.heroAutoSlidesEnabled = false`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
