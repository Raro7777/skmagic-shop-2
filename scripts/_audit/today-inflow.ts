/**
 * 오늘 인입 항목 전체 dump — Lead / ApprovalRequest / Enrollment / NotificationOutbox.
 * KST 기준 2026-06-05 00:00 ~ now.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// KST 2026-06-05 00:00 = UTC 2026-06-04 15:00
const KST_TODAY_START_UTC = new Date("2026-06-04T15:00:00Z");

function fmt(d: Date | null): string {
  if (!d) return "(null)";
  // UTC → KST
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace("T", " ").slice(0, 19) + " KST";
}

async function main() {
  console.log(`▶ KST 2026-06-05 00:00 (UTC 2026-06-04 15:00) 이후 인입 항목 전체\n`);

  // 1) Lead
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: KST_TODAY_START_UTC } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, customerName: true, phoneRaw: true, productInterest: true,
      productCode: true, region: true, partnerId: true, sellerId: true,
      status: true, createdAt: true,
      ownerType: true, source: true, externalChannel: true,
      utmSource: true, utmMedium: true, utmCampaign: true,
      referrer: true, landingPath: true, deviceType: true,
    },
  });
  console.log(`=== [1] Lead 인입: ${leads.length}건 ===`);
  for (const l of leads) {
    const phoneMask = (l.phoneRaw ?? "").replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    console.log(`  [${fmt(l.createdAt)}] ${l.customerName ?? "(이름없음)"} · ${phoneMask}`);
    console.log(`     상품=${l.productInterest ?? l.productCode ?? "—"} · 지역=${l.region ?? "—"} · status=${l.status}`);
    console.log(`     partner=${l.partnerId ?? "(미배정/HQ 풀)"} · seller=${l.sellerId ?? "—"} · ownerType=${l.ownerType ?? "—"}`);
    console.log(`     source=${l.source ?? "—"} · channel=${l.externalChannel ?? "—"} · device=${l.deviceType ?? "—"}`);
    if (l.utmSource || l.utmMedium || l.utmCampaign) console.log(`     utm=${l.utmSource ?? "—"}/${l.utmMedium ?? "—"}/${l.utmCampaign ?? "—"}`);
    if (l.referrer) console.log(`     referrer=${l.referrer.slice(0, 80)}`);
    if (l.landingPath) console.log(`     landing=${l.landingPath.slice(0, 80)}`);
    console.log(`     leadId=${l.id}`);
  }

  // 2) ApprovalRequest (partner_signup 등)
  const reqs = await prisma.approvalRequest.findMany({
    where: { createdAt: { gte: KST_TODAY_START_UTC } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, kind: true, title: true, status: true,
      partnerId: true, requestedByEmail: true, createdAt: true,
    },
  });
  console.log(`\n=== [2] ApprovalRequest: ${reqs.length}건 ===`);
  for (const r of reqs) {
    console.log(`  [${fmt(r.createdAt)}] kind=${r.kind} status=${r.status}`);
    console.log(`     title="${r.title}" email=${r.requestedByEmail ?? "—"} partnerId=${r.partnerId ?? "—"}`);
    console.log(`     id=${r.id}`);
  }

  // 3) EnrollmentForm (가입신청서)
  const forms = await prisma.enrollmentForm.findMany({
    where: { createdAt: { gte: KST_TODAY_START_UTC } },
    orderBy: { createdAt: "desc" },
    select: { id: true, leadId: true, status: true, createdAt: true, customerName: true },
  }).catch(() => []);
  console.log(`\n=== [3] EnrollmentForm(가입신청서): ${forms.length}건 ===`);
  for (const e of forms) {
    console.log(`  [${fmt(e.createdAt)}] ${e.customerName ?? "(이름없음)"} status=${e.status} leadId=${e.leadId ?? "—"}`);
  }

  // 4) NotificationOutbox (텔레그램 X — outbox 는 이메일/SMS. 텔레그램은 별도)
  const outbox = await prisma.notificationOutbox.findMany({
    where: { createdAt: { gte: KST_TODAY_START_UTC } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, channel: true, toAddress: true, subject: true, status: true, createdAt: true, provider: true,
    },
  });
  console.log(`\n=== [4] NotificationOutbox(이메일/SMS): ${outbox.length}건 ===`);
  for (const o of outbox) {
    console.log(`  [${fmt(o.createdAt)}] ${o.channel}/${o.provider} → ${o.toAddress} (${o.status}) "${o.subject ?? ""}"`);
  }

  // 5) 종합 — 오늘 새 인입 총 카운트
  console.log(`\n📊 오늘 인입 종합`);
  console.log(`   Lead             : ${leads.length}건`);
  console.log(`   ApprovalRequest  : ${reqs.length}건`);
  console.log(`   EnrollmentForm   : ${forms.length}건`);
  console.log(`   알림(outbox)     : ${outbox.length}건`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
