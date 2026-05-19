/**
 * 분양 승인 시 자동 생성된 협력점들에 어떤 부수 row 가 붙어있는지 점검.
 * "더미 데이터" 가 무엇인지 파악하기 위함 (read-only).
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const partners = await prisma.partner.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          leads: true, users: true, policies: true, settlements: true,
          approvals: true, sellers: true, banners: true, reviews: true,
        },
      },
    },
  });
  console.log(`총 ${partners.length}개 partner\n`);
  for (const p of partners) {
    const c = p._count;
    console.log(`${p.partnerCode} (${p.partnerName})`);
    console.log(`  status=${p.status} tier=${p.tier}`);
    console.log(`  brandLabel="${p.brandLabel}" hotline="${p.hotlineNumber}"`);
    console.log(`  rentalSupport=${p.rentalSupportAmount}(${p.rentalSupportEnabled ? "ON" : "OFF"}) sellerMargin=${p.sellerMarginType}/${p.sellerMarginAmount}/${p.sellerMarginPercent}`);
    console.log(`  displayConfig=${p.displayConfig ? JSON.stringify(p.displayConfig).slice(0, 100) : "null"}`);
    console.log(`  customDomain=${p.customDomain ?? "—"} theme=${p.theme}`);
    console.log(`  counts: leads=${c.leads} users=${c.users} policies=${c.policies} settlements=${c.settlements} approvals=${c.approvals} sellers=${c.sellers} banners=${c.banners} reviews=${c.reviews}`);
    console.log();
  }

  // PartnerPolicy / Banner / Review 가 어디서 자동 시드되는지 — 협력점에 직접 붙은 row 만 점검
  console.log("=== Banner 시드 ===");
  const banners = await prisma.banner.findMany({ orderBy: { createdAt: "asc" } });
  for (const b of banners) {
    console.log(`  ${b.partnerId} · "${b.title}" · ${b.status} · ${b.startsAt.toISOString().slice(0, 10)} ~ ${b.endsAt.toISOString().slice(0, 10)}`);
  }

  console.log("\n=== Review 시드 ===");
  const reviews = await prisma.review.findMany({ orderBy: { createdAt: "asc" }, take: 30 });
  for (const r of reviews) {
    console.log(`  ${r.partnerId ?? "(hq)"} · "${r.title ?? "(no title)"}" by ${r.customerName} · ${r.status}/${r.approvalStatus}`);
  }
  if (reviews.length === 30) console.log("  ... (truncated)");

  console.log("\n=== PartnerPolicy 시드 ===");
  const policies = await prisma.partnerPolicy.findMany({ take: 5 });
  for (const p of policies) {
    console.log(`  ${p.partnerId} · product=${p.productCode} · gift=${p.giftAmount} install=${p.installAmount}`);
  }
  const allPoliciesCount = await prisma.partnerPolicy.count();
  console.log(`  (total ${allPoliciesCount} rows)`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
