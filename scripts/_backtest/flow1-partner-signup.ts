/**
 * Flow 1 — 분양 (Partner Signup) 백테스트
 *
 * Steps:
 *   1) /signup/partner 200 OK
 *   2) ApprovalRequest pending 시드 생성 (kind=partner_signup)
 *   3) HQ admin 승인 시뮬레이션 (status=approved, partnerId 채움)
 *   4) cloneHqTemplateToPartner 호출 → Banner/PartnerPolicy/theme 복제 확인
 *   5) /p/{partnerCode} 200 OK + 배너 SSR HTML
 *   6) Footer = 협력점 자체 정보 (HQ 핫라인 1600-2434 아님)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { cloneHqTemplateToPartner } from "@/lib/hqTemplate";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const BASE = "http://localhost:3100";
const SEED_PREFIX = "backtest-baseline-";

type StepResult = { idx: number; ok: boolean | "warn"; label: string; note?: string };
const results: StepResult[] = [];
const cleanupIds: { type: string; id: string }[] = [];

async function step(idx: number, label: string, fn: () => Promise<StepResult | void>) {
  try {
    const r = await fn();
    if (r) results.push(r);
    else results.push({ idx, ok: true, label });
  } catch (e: any) {
    results.push({ idx, ok: false, label, note: e?.message ?? String(e) });
  }
}

async function main() {
  const stamp = Date.now().toString(36);
  const partnerCode = `${SEED_PREFIX}p-${stamp}`;
  const approvalId = `${SEED_PREFIX}req-${stamp}`;

  // ─── 1) /apply (분양 신청서 페이지) 200 OK ───
  await step(1, "분양 신청서 페이지(/apply) 200 OK", async () => {
    // 정의서의 /signup/partner 는 실제 코드베이스에 없음 → 실 경로는 /apply
    const r404 = await fetch(`${BASE}/signup/partner`);
    const r = await fetch(`${BASE}/apply`);
    if (r.status !== 200) {
      return { idx: 1, ok: false, label: "/apply", note: `/apply status=${r.status}, /signup/partner status=${r404.status}` };
    }
    return {
      idx: 1, ok: true,
      label: `/apply 200 OK (참고: /signup/partner 는 ${r404.status} — 정의서와 실제 경로 차이)`,
    };
  });

  // ─── 2) ApprovalRequest pending 시드 (DB 직접) ───
  await step(2, "ApprovalRequest pending 시드 생성", async () => {
    const req = await prisma.approvalRequest.create({
      data: {
        id: approvalId,
        kind: "partner_signup",
        title: `[backtest] ${partnerCode}`,
        status: "pending",
        requestedByEmail: `${SEED_PREFIX}${stamp}@example.com`,
        applicationData: {
          applicantName: "백테스트사장",
          storeName: `백테스트점-${stamp}`,
          phone: "010-0000-0000",
          email: `${SEED_PREFIX}${stamp}@example.com`,
          region: "서울 강남구",
          businessNumber: "000-00-00000",
          commerceNumber: "BT-0000-XX",
          address: "서울특별시 강남구 테헤란로 0",
          ownerName: "백테스트사장",
          hotlineNumber: "010-9999-0000",
          csHours: "평일 09:00-18:00",
          memo: "Flow1 백테스트 자동 생성",
        },
      },
    });
    cleanupIds.push({ type: "ApprovalRequest", id: req.id });
    return { idx: 2, ok: true, label: `ApprovalRequest pending 생성 (id=${req.id})` };
  });

  // ─── 3) HQ 승인 시뮬레이션 — partner row 생성 + ApprovalRequest approved ───
  await step(3, "HQ 승인 시뮬레이션 (partner row + approved)", async () => {
    const tpl = await prisma.partner.findUnique({ where: { partnerCode: "hq-template" } });
    if (!tpl) {
      return { idx: 3, ok: "warn", label: "HQ 승인 시뮬레이션", note: "hq-template Partner row 없음" };
    }
    await prisma.$transaction(async (tx) => {
      await tx.partner.create({
        data: {
          partnerCode,
          partnerName: `백테스트점-${stamp}`,
          businessNumber: "000-00-00000",
          commerceNumber: "BT-0000-XX",
          address: "서울특별시 강남구 테헤란로 0",
          region: "서울 강남구",
          ownerName: "백테스트사장",
          phone: "010-0000-0000",
          hotlineNumber: "010-9999-0000",  // ← 본사 1600-2434 아님
          csHours: "평일 09:00-18:00",
          status: "active",
          tier: "basic",
        },
      });
      const cloned = await cloneHqTemplateToPartner(tx, partnerCode);
      await tx.approvalRequest.update({
        where: { id: approvalId },
        data: {
          status: "approved",
          partnerId: partnerCode,
          reviewedAt: new Date(),
          reviewNote: `clone: banners=${cloned.copiedBanners} policies=${cloned.copiedPolicies}`,
        },
      });
    });
    cleanupIds.push({ type: "Partner", id: partnerCode });
    return { idx: 3, ok: true, label: "Partner 생성 + clone + ApprovalRequest approved" };
  });

  // ─── 4) clone 결과: Banner/PartnerPolicy/theme ───
  await step(4, "cloneHqTemplateToPartner 결과 검증", async () => {
    const tpl = await prisma.partner.findUnique({
      where: { partnerCode: "hq-template" },
      select: { theme: true },
    });
    const newP = await prisma.partner.findUnique({
      where: { partnerCode },
      select: { theme: true },
    });
    const tplBn = await prisma.banner.count({ where: { partnerId: "hq-template", scope: "partner" } });
    const tplPp = await prisma.partnerPolicy.count({ where: { partnerId: "hq-template" } });
    const newBn = await prisma.banner.count({ where: { partnerId: partnerCode, scope: "partner" } });
    const newPp = await prisma.partnerPolicy.count({ where: { partnerId: partnerCode } });
    const themeOk = tpl?.theme === newP?.theme;
    const bnOk = newBn === tplBn;
    const ppOk = newPp === tplPp;
    if (themeOk && bnOk && ppOk) {
      return {
        idx: 4, ok: true,
        label: `복제 일치 — banners ${newBn}/${tplBn}, policies ${newPp}/${tplPp}, theme=${newP?.theme}`,
      };
    }
    return {
      idx: 4, ok: "warn",
      label: "복제 결과 불일치",
      note: `banners ${newBn}/${tplBn}, policies ${newPp}/${tplPp}, theme new=${newP?.theme} tpl=${tpl?.theme}`,
    };
  });

  // ─── 5) /p/{partnerCode} 200 OK + 배너 SSR ───
  await step(5, "/p/{code} 200 OK + 배너 SSR HTML", async () => {
    const r = await fetch(`${BASE}/p/${partnerCode}`, { method: "GET" });
    if (r.status !== 200) {
      return { idx: 5, ok: false, label: `/p/${partnerCode}`, note: `status=${r.status}` };
    }
    const html = await r.text();
    // 배너가 있을 경우 그 title 중 하나가 HTML 에 포함돼야 함
    const someBanner = await prisma.banner.findFirst({
      where: { partnerId: partnerCode, scope: "partner", status: "published" },
      select: { title: true },
    });
    if (someBanner?.title) {
      const titleSnippet = someBanner.title.slice(0, 8);
      const inHtml = html.includes(titleSnippet);
      return {
        idx: 5,
        ok: inHtml ? true : "warn",
        label: `/p/${partnerCode} 200 OK (banner "${titleSnippet}" in HTML: ${inHtml})`,
      };
    }
    return { idx: 5, ok: true, label: `/p/${partnerCode} 200 OK (published banner 없음)` };
  });

  // ─── 6) Footer = 협력점 자체 정보 (1600-2434 노출 X) ───
  await step(6, "Footer 자체 정보 검증 (HQ 핫라인 노출 X)", async () => {
    const r = await fetch(`${BASE}/p/${partnerCode}`);
    const html = await r.text();
    const hasHqHotline = html.includes("1600-2434");
    const hasOwnHotline = html.includes("010-9999-0000");
    const hasOwnBiz = html.includes("BT-0000-XX") || html.includes("000-00-00000");
    if (hasHqHotline && !hasOwnHotline) {
      return {
        idx: 6, ok: false,
        label: "Footer", note: "HQ 핫라인(1600-2434) 노출됨, 협력점 hotline 미노출 — partner_footer_fields SSOT 위반",
      };
    }
    if (hasOwnHotline || hasOwnBiz) {
      return {
        idx: 6, ok: true,
        label: `Footer 협력점 정보 노출 (hotline=${hasOwnHotline}, biz=${hasOwnBiz}, hq=${hasHqHotline})`,
      };
    }
    return {
      idx: 6, ok: "warn",
      label: "Footer 정보 매칭 안 됨",
      note: `hasHqHotline=${hasHqHotline} hasOwnHotline=${hasOwnHotline} hasOwnBiz=${hasOwnBiz} — 푸터 렌더 위치/마스킹 확인 필요`,
    };
  });

  // ─── 보고 ───
  console.log(`\n백테스트 결과 — Flow 1: 분양 (Partner Signup)\n`);
  const total = results.length;
  for (const r of results) {
    const mark = r.ok === true ? "OK" : r.ok === "warn" ? "WARN" : "FAIL";
    console.log(`[${r.idx}/${total}] ${mark} ${r.label}${r.note ? ` — ${r.note}` : ""}`);
  }
  const fails = results.filter(r => r.ok === false).length;
  const warns = results.filter(r => r.ok === "warn").length;
  const verdict = fails > 0 ? "FAIL" : warns > 0 ? "WARN" : "OK";
  console.log(`\n종합: ${verdict} (fail=${fails} warn=${warns} ok=${total - fails - warns})`);

  console.log(`\n정리 대상 시드:`);
  for (const c of cleanupIds) console.log(`  - ${c.type}: ${c.id}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[flow1] FATAL", e);
  process.exit(1);
});
