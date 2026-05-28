/**
 * partner_signup ApprovalRequest 10건 중 필수 필드 누락된 row 검사 + Partner backfill.
 *
 * 전략:
 *   - 신청서(applicationData) 의 businessNumber/ownerName(applicantName)/address 가 있고
 *     해당 Partner 컬럼은 비어있는 경우 → Partner 컬럼 채움
 *   - 신청서에서도 누락 → 그대로 두고 ⚠ 표시 (강제 dummy 안 채움)
 *   - rejected 는 partnerId 자체 없으므로 backfill 안 함 (history 만 표시)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.env.DRY_RUN === "1";

type AppData = {
  applicantName?: string;
  storeName?: string;
  phone?: string;
  email?: string;
  region?: string;
  address?: string;
  businessNumber?: string;
  commerceNumber?: string;
  hotlineNumber?: string;
};

async function main() {
  console.log(`▶ 모드: ${DRY_RUN ? "DRY-RUN" : "실제 적용"}\n`);

  const reqs = await prisma.approvalRequest.findMany({
    where: { kind: "partner_signup" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, title: true, partnerId: true, applicationData: true, createdAt: true },
  });

  console.log(`총 ${reqs.length}건의 partner_signup\n`);

  let backfilledCount = 0;
  let stillIncompleteCount = 0;

  for (const r of reqs) {
    const data = (r.applicationData as AppData | null) ?? {};
    const missing: string[] = [];
    if (!data.businessNumber?.trim()) missing.push("businessNumber");
    if (!data.applicantName?.trim()) missing.push("applicantName/ownerName");
    if (!data.address?.trim()) missing.push("address");
    if (missing.length === 0) continue; // 정상 — skip

    const ts = r.createdAt.toISOString().slice(0, 16);
    console.log(`[${ts}] status=${r.status} title="${r.title}" partnerId=${r.partnerId ?? "—"}`);
    console.log(`   누락: ${missing.join(", ")}`);

    if (r.status === "approved" && r.partnerId) {
      // Partner row 와 비교
      const p = await prisma.partner.findUnique({
        where: { partnerCode: r.partnerId },
        select: { partnerCode: true, ownerName: true, businessNumber: true, address: true },
      });
      if (!p) {
        console.log(`   ⚠ approved 인데 Partner row 없음 — 매핑 깨짐`);
        stillIncompleteCount++;
        continue;
      }
      const patch: { ownerName?: string; businessNumber?: string; address?: string } = {};
      if (!p.ownerName?.trim() && data.applicantName?.trim()) patch.ownerName = data.applicantName.trim();
      if (!p.businessNumber?.trim() && data.businessNumber?.trim()) patch.businessNumber = data.businessNumber.trim();
      if (!p.address?.trim() && data.address?.trim()) patch.address = data.address.trim();

      if (Object.keys(patch).length === 0) {
        console.log(`   ℹ Partner 컬럼은 이미 채워져 있거나, 신청서에도 정보 없음 → no-op`);
        stillIncompleteCount++;
        continue;
      }

      console.log(`   → backfill 대상: ${JSON.stringify(patch)}`);
      if (!DRY_RUN) {
        await prisma.partner.update({ where: { partnerCode: r.partnerId }, data: patch });
        console.log(`   ✅ 적용 완료`);
      }
      backfilledCount++;
    } else {
      console.log(`   (status=${r.status} — Partner row 없음, skip)`);
    }
  }

  console.log(`\n📊 결과:`);
  console.log(`   backfill ${DRY_RUN ? "예정" : "완료"}: ${backfilledCount}건`);
  console.log(`   여전히 불완전: ${stillIncompleteCount}건 (신청서 자체 누락)`);

  // 사후 검증
  if (!DRY_RUN) {
    console.log(`\n=== 사후 검증: 협력점 7곳 PII 필드 ===`);
    const partners = await prisma.partner.findMany({
      where: { partnerCode: { not: "hq-template" }, status: "active" },
      select: { partnerCode: true, partnerName: true, ownerName: true, businessNumber: true, address: true, hotlineNumber: true },
    });
    for (const p of partners) {
      const owner = p.ownerName?.trim() || "❌ NULL";
      const biz = p.businessNumber?.trim() || "❌ NULL";
      const addr = p.address?.trim() || "❌ NULL";
      console.log(`  ${p.partnerName} (${p.partnerCode})`);
      console.log(`    ownerName=${owner} · businessNumber=${biz} · address=${addr}`);
      console.log(`    hotlineNumber="${p.hotlineNumber}" ${p.hotlineNumber === "1600-2434" ? "❌ 본사 핫라인" : "✅"}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
