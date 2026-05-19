/**
 * 분양된 협력점들의 Partner row 푸터값을 ApprovalRequest.applicationData 로
 * 백필한다. 옛 데이터 (분양 신청서 → Partner 매핑 PR 이전에 생성된 partner) 에서
 * partnerName 이 "우성종합통신" 처럼 본사명으로 잘못 들어간 경우가 있어 푸터에
 * "상호: 우성종합통신" 으로 노출되던 문제 해결.
 *
 * 안전망:
 *   - partner_signup approval 이 있는 partner 만 대상 (본사 직영 partner 는 건너뜀)
 *   - dry-run 기본. 실제 적용은 --commit 옵션 필요
 *
 * 사용법:
 *   npx tsx scripts/backfill-partner-from-approval.ts            # dry-run
 *   npx tsx scripts/backfill-partner-from-approval.ts --commit   # 실제 적용
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const COMMIT = process.argv.includes("--commit");

// approvals/[id]/route.ts 의 텍스트 파싱과 동일 — applicationData 없는 옛 approval fallback
function parseApplicationBody(body: string | null) {
  const out: { region?: string; phone?: string; email?: string } = {};
  if (!body) return out;
  for (const part of body.split(" · ")) {
    const m = part.match(/^([^:]+):\s*(.+)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "지역") out.region = v;
    else if (k === "연락처") out.phone = v;
    else if (k === "이메일") out.email = v;
  }
  return out;
}
function parseApplicant(reason: string | null): string | null {
  if (!reason) return null;
  const m = reason.match(/applicant=(.+)/);
  return m ? m[1].trim() : null;
}

type AppData = {
  applicantName?: string;
  storeName?: string;
  phone?: string;
  email?: string | null;
  region?: string | null;
};

async function main() {
  console.log(COMMIT ? "🚨 COMMIT MODE — DB 에 실제 변경 적용\n" : "🔍 DRY-RUN — 변경 사항 미리보기만 (실제 적용은 --commit)\n");

  // partnerId 가 연결된 partner_signup approved approval 만 (백필 대상 = 분양 승인된 협력점)
  const approvals = await prisma.approvalRequest.findMany({
    where: { kind: "partner_signup", status: "approved", partnerId: { not: null } },
    orderBy: { reviewedAt: "asc" },
  });

  console.log(`approval 후보 ${approvals.length}건\n`);

  let touched = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const appr of approvals) {
    const partner = await prisma.partner.findUnique({ where: { partnerCode: appr.partnerId! } });
    if (!partner) {
      console.log(`  SKIP ${appr.partnerId} — partner row 없음`);
      skipped++;
      continue;
    }

    const appData = (appr.applicationData ?? null) as AppData | null;
    const parsed = parseApplicationBody(appr.body);
    const applicantName = appData?.applicantName?.trim() || parseApplicant(appr.reason);
    const storeName = (appData?.storeName?.trim() || appr.title || "").trim().slice(0, 80);
    const phone = appData?.phone?.trim() || parsed.phone || null;
    const region = appData?.region?.trim() || parsed.region || null;

    if (!storeName) {
      console.log(`  SKIP ${partner.partnerCode} — storeName 없음 (approval id=${appr.id})`);
      skipped++;
      continue;
    }

    const updates: Record<string, string | null> = {};
    if (partner.partnerName !== storeName) updates.partnerName = storeName;
    if (applicantName && partner.ownerName !== applicantName) updates.ownerName = applicantName;
    if (phone && partner.phone !== phone) updates.phone = phone;
    if (region && partner.region !== region) updates.region = region;

    if (Object.keys(updates).length === 0) {
      unchanged++;
      continue;
    }

    console.log(`${partner.partnerCode}  (${partner.partnerName})`);
    for (const [k, v] of Object.entries(updates)) {
      const before = (partner as unknown as Record<string, unknown>)[k];
      console.log(`    ${k.padEnd(13)} : ${String(before ?? "—").padEnd(28)} → ${v}`);
    }

    if (COMMIT) {
      await prisma.partner.update({ where: { id: partner.id }, data: updates });
    }
    touched++;
  }

  console.log(`\n${COMMIT ? "" : "[DRY] "}변경 대상 ${touched}건 · 이미 동기화 ${unchanged}건 · 스킵 ${skipped}건`);
  if (!COMMIT && touched > 0) {
    console.log("\n실제 적용:\n  npx tsx scripts/backfill-partner-from-approval.ts --commit");
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
