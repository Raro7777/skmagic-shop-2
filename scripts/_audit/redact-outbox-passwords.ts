/**
 * NotificationOutbox 의 historical 평문 임시비밀번호 일괄 redact.
 *
 * 대상: body 에 "임시 비밀번호:" 또는 "임시비밀번호:" 포함된 row
 * 처리: body 를 placeholder 로 교체 (발송 결과 status / sentAt / provider 는 보존)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.env.DRY_RUN === "1";
const PATTERNS = ["임시 비밀번호:", "임시비밀번호:"];
const REDACTED = "[REDACTED: 평문 임시비밀번호 — historical cleanup 2026-05-28]";

async function main() {
  console.log(`▶ 모드: ${DRY_RUN ? "DRY-RUN" : "실제 적용"}\n`);

  const rows = await prisma.notificationOutbox.findMany({
    where: {
      OR: PATTERNS.map(p => ({ body: { contains: p } })),
    },
    select: { id: true, channel: true, toAddress: true, subject: true, createdAt: true, provider: true, status: true },
  });

  console.log(`대상 row: ${rows.length}건\n`);
  for (const r of rows) {
    const ts = r.createdAt.toISOString().slice(0, 16);
    console.log(`  [${ts}] ${r.channel}/${r.provider} → ${r.toAddress} (${r.status}) subject="${r.subject ?? ""}"`);
  }

  if (rows.length === 0) {
    console.log("\n청소 대상 없음 — 이미 깨끗");
    return;
  }

  if (DRY_RUN) {
    console.log("\nDRY-RUN: 실제 적용 시 위 row 들의 body 를 placeholder 로 교체");
    return;
  }

  const result = await prisma.notificationOutbox.updateMany({
    where: { id: { in: rows.map(r => r.id) } },
    data: { body: REDACTED },
  });
  console.log(`\n✅ ${result.count}건 redact 완료`);

  // 사후 검증
  const remaining = await prisma.notificationOutbox.count({
    where: { OR: PATTERNS.map(p => ({ body: { contains: p } })) },
  });
  console.log(`사후 검증: 남은 평문 row = ${remaining}건 ${remaining === 0 ? "✅" : "❌"}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
