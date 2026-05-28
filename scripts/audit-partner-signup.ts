/**
 * 분양 신청 흐름 백테스트:
 *   1) ApprovalRequest (kind=partner_signup) 최근 이력 + 상태
 *   2) hq-template Partner / Banner / PartnerPolicy 정상 존재 여부
 *   3) 최근 생성된 Partner — 본사 표준 복제가 잘 됐는지 (배너/정책 카운트)
 *   4) 가장 최근 pending partner_signup — 어떤 단계에서 막혀있는지
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const HQ_TEMPLATE = "hq-template";

async function main() {
  console.log("\n=== 1) hq-template Partner 상태 ===");
  const tpl = await prisma.partner.findUnique({
    where: { partnerCode: HQ_TEMPLATE },
    select: {
      partnerCode: true, partnerName: true, status: true,
      theme: true, rentalSupportAmount: true, rentalSupportEnabled: true,
      sellerMarginType: true, sellerMarginAmount: true,
    },
  });
  if (!tpl) {
    console.log("⚠ hq-template Partner row 없음 — 신규 협력점 생성 시 본사 표준 복제 실패");
  } else {
    console.log(JSON.stringify(tpl, null, 2));
  }

  const tplBanners = await prisma.banner.count({ where: { partnerId: HQ_TEMPLATE, scope: "partner" } });
  const tplPolicies = await prisma.partnerPolicy.count({ where: { partnerId: HQ_TEMPLATE } });
  console.log(`  Banner (partner scope) : ${tplBanners}건`);
  console.log(`  PartnerPolicy           : ${tplPolicies}건`);

  console.log("\n=== 2) ApprovalRequest (partner_signup) 최근 15건 ===");
  const reqs = await prisma.approvalRequest.findMany({
    where: { kind: "partner_signup" },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true, status: true, title: true, partnerId: true, requestedByEmail: true,
      reviewedAt: true, reviewNote: true, createdAt: true,
    },
  });
  for (const r of reqs) {
    const ts = r.createdAt.toISOString().replace("T", " ").slice(0, 19);
    console.log(`[${ts}] status=${r.status} title="${r.title}" partnerId=${r.partnerId ?? "—"} email=${r.requestedByEmail ?? "—"}`);
    if (r.reviewNote) console.log(`  note: ${r.reviewNote.slice(0, 80)}`);
  }

  // status 집계
  const grouped = await prisma.approvalRequest.groupBy({
    by: ["status"],
    where: { kind: "partner_signup" },
    _count: { _all: true },
  });
  console.log("\n=== partner_signup status 집계 ===");
  for (const g of grouped) {
    console.log(`  status=${g.status} → ${g._count._all}건`);
  }

  console.log("\n=== 3) 최근 7일 생성 Partner ===");
  const recentPartners = await prisma.partner.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      partnerCode: { not: HQ_TEMPLATE },
    },
    orderBy: { createdAt: "desc" },
    select: {
      partnerCode: true, partnerName: true, status: true, tier: true,
      theme: true, rentalSupportAmount: true,
      sellerMarginAmount: true,
      banners: { where: { scope: "partner" }, select: { id: true } },
      policies: { select: { id: true } },
      sellers: { select: { id: true } },
      leads: { select: { id: true } },
      createdAt: true,
    },
  });
  if (recentPartners.length === 0) {
    console.log("  최근 7일 신규 협력점 없음");
  }
  for (const p of recentPartners) {
    console.log(`\n  ${p.partnerName} (${p.partnerCode}) — ${p.createdAt.toISOString().slice(0, 16)} status=${p.status} tier=${p.tier}`);
    console.log(`    theme=${p.theme} 보장=${p.rentalSupportAmount.toLocaleString()} sellerMargin=${p.sellerMarginAmount.toLocaleString()}`);
    console.log(`    배너 ${p.banners.length}개 · 정책 ${p.policies.length}개 · 영업자 ${p.sellers.length}명 · lead ${p.leads.length}건`);
    if (p.banners.length === 0 && tplBanners > 0) console.log(`    ⚠ 본사 표준 배너 ${tplBanners}개 있는데 복제 안 됨`);
    if (p.policies.length === 0 && tplPolicies > 0) console.log(`    ⚠ 본사 표준 정책 ${tplPolicies}개 있는데 복제 안 됨`);
  }

  console.log("\n=== 4) Pending partner_signup 상세 (있으면) ===");
  const pendings = await prisma.approvalRequest.findMany({
    where: { kind: "partner_signup", status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (pendings.length === 0) console.log("  pending 없음");
  for (const p of pendings) {
    console.log(`  id=${p.id.slice(0, 8)} title="${p.title}" email=${p.requestedByEmail}`);
    console.log(`    body=${(p.body ?? "").slice(0, 100)}`);
    if (p.applicationData) console.log(`    applicationData keys=${Object.keys(p.applicationData as object).join(", ")}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
