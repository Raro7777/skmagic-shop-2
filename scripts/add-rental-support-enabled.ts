/**
 * Partner.rentalSupportEnabled 컬럼 추가 — 협력점이 소비자 사이트에서 렌탈지원금 표시 ON/OFF.
 *   기본값 true (기존 협력점은 ON 상태 유지).
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "rentalSupportEnabled" BOOLEAN NOT NULL DEFAULT TRUE`);
  console.log("  ✓ rentalSupportEnabled BOOLEAN DEFAULT TRUE");

  // 인터넷끝판왕은 명시적으로 ON
  await prisma.partner.update({
    where: { partnerCode: "partner-7714c0" },
    data: { rentalSupportEnabled: true },
  });
  console.log("  ✓ 인터넷끝판왕 rentalSupportEnabled = true");
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
