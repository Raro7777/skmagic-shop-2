import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "theme" TEXT NOT NULL DEFAULT 'default'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "previousTheme" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "themeChangedAt" TIMESTAMPTZ`);
  console.log("  ✓ Partner.theme TEXT NOT NULL DEFAULT 'default'");
  console.log("  ✓ Partner.previousTheme TEXT (rollback)");
  console.log("  ✓ Partner.themeChangedAt TIMESTAMPTZ (24h rollback window)");
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
