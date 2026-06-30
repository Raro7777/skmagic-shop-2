import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const LEAD_ID = "cmq09wyun001604jvcadfphoh";

function fmt(d: Date | null | undefined): string {
  if (!d) return "(null)";
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace("T", " ").slice(0, 19) + " KST";
}

async function main() {
  const lead = await prisma.lead.findUnique({
    where: { id: LEAD_ID },
    include: {
      statusLogs: { orderBy: { createdAt: "asc" } },
      enrollmentForm: true,
      settlement: true,
      partner: { select: { partnerName: true, partnerCode: true } },
      seller: { select: { name: true, sellerCode: true } },
    },
  });
  if (!lead) { console.log("없음"); return; }

  console.log("========== Lead 상세 ==========");
  console.log(`id:               ${lead.id}`);
  console.log(`customerName:     ${lead.customerName}`);
  console.log(`phoneRaw:         ${lead.phoneRaw}`);
  console.log(`status:           ${lead.status}`);
  console.log(`createdAt:        ${fmt(lead.createdAt)}`);
  console.log(`updatedAt:        ${fmt(lead.updatedAt)}`);
  console.log(`cancelledAt:      ${fmt(lead.cancelledAt)}`);
  console.log(`cancelReason:     ${lead.cancelReason ?? "(null)"}`);
  console.log(`duplicateStatus:  ${lead.duplicateStatus ?? "(null)"}`);
  console.log(`verifyAttempts:   ${lead.verifyAttempts}`);
  console.log(`verifyLastReason: ${lead.verifyLastReason ?? "(null)"}`);
  console.log(`productInterest:  ${lead.productInterest}`);
  console.log(`productCode:      ${lead.productCode ?? "(null)"}`);
  console.log(`region:           ${lead.region}`);
  console.log(`ownerType:        ${lead.ownerType}`);
  console.log(`partner:          ${lead.partner?.partnerName ?? "—"} (${lead.partnerId})`);
  console.log(`seller:           ${lead.seller?.name ?? "—"}`);
  console.log(`source:           ${lead.source ?? "—"}`);
  console.log(`externalChannel:  ${lead.externalChannel ?? "—"}`);
  console.log(`referrer:         ${lead.referrer ?? "—"}`);
  console.log(`landingPath:      ${lead.landingPath ?? "—"}`);
  console.log(`utmSource:        ${lead.utmSource ?? "—"}`);
  console.log(`deviceType:       ${lead.deviceType ?? "—"}`);
  console.log(`selectedMode:     ${lead.selectedMode ?? "—"}`);
  console.log(`selectedContractPeriod: ${lead.selectedContractPeriod ?? "—"}`);

  console.log(`\n========== StatusLog (${lead.statusLogs.length}건) ==========`);
  for (const log of lead.statusLogs) {
    console.log(`  [${fmt(log.createdAt)}] ${log.fromStatus ?? "(init)"} → ${log.toStatus}`);
    console.log(`     actor=${log.actorRole ?? "—"} (${log.actorEmail ?? "—"}) note=${log.note ?? "—"}`);
  }

  console.log(`\n========== EnrollmentForm ==========`);
  if (lead.enrollmentForm) {
    console.log(`  status=${lead.enrollmentForm.status} createdAt=${fmt(lead.enrollmentForm.createdAt)}`);
    console.log(`  customerName=${lead.enrollmentForm.customerName ?? "(null)"}`);
  } else {
    console.log(`  (없음 — 가입신청서 진입 X)`);
  }

  console.log(`\n========== Settlement ==========`);
  if (lead.settlement) {
    console.log(`  status=${lead.settlement.status} partnerCommission=${lead.settlement.partnerCommission}`);
  } else {
    console.log(`  (없음 — 정산 진입 X)`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
