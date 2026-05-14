import { prisma } from "../src/lib/prisma";

async function main() {
  // 1) EnrollmentFormHistory — 신청서 변경 이력 (감사 로그)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EnrollmentFormHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "formId" TEXT NOT NULL,
      "leadId" TEXT NOT NULL,
      "changedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "changedById" TEXT,
      "changedByRole" TEXT NOT NULL,
      "reason" TEXT,
      "changeSource" TEXT NOT NULL,
      "changes" JSONB NOT NULL,
      "snapshotAfter" JSONB NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "EnrollmentFormHistory_leadId_changedAt_idx"
      ON "EnrollmentFormHistory" ("leadId", "changedAt" DESC)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "EnrollmentFormHistory_formId_idx"
      ON "EnrollmentFormHistory" ("formId")
  `);
  console.log("  ✓ EnrollmentFormHistory 테이블 + 인덱스 2개");

  // 2) Settlement 스냅샷 컬럼 — 정산 시점 신청서 핵심 필드 보존
  const cols: Array<[string, string]> = [
    ["enrollmentMonthlyPrice",   "INTEGER"],
    ["enrollmentContractPeriod", "INTEGER"],
    ["enrollmentManagementMode", "TEXT"],
    ["enrollmentIsRival",        "BOOLEAN DEFAULT FALSE"],
    ["enrollmentHalfMonths",     "INTEGER"],
    ["enrollmentGiftLabel",      "TEXT"],
    ["enrollmentSnapshotJson",   "JSONB"],
  ];
  for (const [name, type] of cols) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
    console.log(`  ✓ Settlement.${name} ${type}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
