import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "htmlContent" TEXT`);
  console.log("  ✓ Banner.htmlContent TEXT (nullable)");
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
