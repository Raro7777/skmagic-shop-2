import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const rows = await prisma.notificationOutbox.findMany({
    where: { channel: "telegram" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log(`telegram outbox row: ${rows.length}건 (최신 10건)`);
  for (const r of rows) {
    const kst = new Date(r.createdAt.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19);
    console.log(`  [${kst} KST] ${r.subject} → ${r.toAddress} (${r.status})`);
    if (r.lastError) console.log(`     err: ${r.lastError.slice(0, 120)}`);
    if (r.body) console.log(`     body: ${r.body.slice(0, 100)}`);
  }
  const testLead = await prisma.lead.findFirst({
    where: { customerName: "[테스트] 알림검증" },
    orderBy: { createdAt: "desc" },
  });
  if (testLead) {
    console.log(`\n테스트 lead 정리: ${testLead.id}`);
    await prisma.leadStatusLog.deleteMany({ where: { leadId: testLead.id } });
    await prisma.lead.delete({ where: { id: testLead.id } });
    console.log("✅ 삭제 완료");
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
