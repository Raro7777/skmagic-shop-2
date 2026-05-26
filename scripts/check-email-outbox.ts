import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 최근 10건 이메일 outbox
  const recent = await prisma.notificationOutbox.findMany({
    where: { channel: "email" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log(`\n=== 최근 이메일 outbox ${recent.length}건 ===\n`);
  for (const r of recent) {
    const ts = r.createdAt.toISOString().replace("T", " ").slice(0, 19);
    console.log(`[${ts}] provider=${r.provider} status=${r.status}`);
    console.log(`  to: ${r.toAddress}`);
    console.log(`  subject: ${r.subject ?? "(없음)"}`);
    if (r.sentAt) console.log(`  sentAt: ${r.sentAt.toISOString().replace("T"," ").slice(0,19)}`);
    if (r.lastError) console.log(`  ⚠ error: ${r.lastError}`);
    console.log();
  }

  // provider/status 집계
  const grouped = await prisma.notificationOutbox.groupBy({
    by: ["provider", "status"],
    where: { channel: "email" },
    _count: { _all: true },
  });
  console.log("=== provider × status 집계 ===");
  for (const g of grouped) {
    console.log(`  provider=${g.provider} status=${g.status} → ${g._count._all}건`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
