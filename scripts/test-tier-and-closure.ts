/**
 * Phase 2 + 3 E2E:
 *   1. basic 협력점이 display-config / banner POST 시 403 (tier 게이트)
 *   2. standard+ 협력점은 통과
 *   3. HQ가 PATCH로 tier 변경
 *   4. HQ가 협력점 퇴점 처리 — active lead가 hq_pool로 이전, seller deactive
 *   5. 퇴점 협력점 사이트는 404
 *   6. 퇴점 협력점 sellerCode로 lead 신청 시 hq_pool로 강제
 *   7. 재활성화
 *
 * 멱등성: 테스트 partner 사용하지 않고 기존 partner로 검증 — 끝나면 원상복구.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const BASE = "https://rentking-next.vercel.app";
const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const ok = (n: string, d = "") => { results.push({ name: n, ok: true, detail: d }); console.log(`  ✓ ${n}${d ? " — " + d : ""}`); };
const ko = (n: string, d: string) => { results.push({ name: n, ok: false, detail: d }); console.log(`  ✗ ${n} — ${d}`); };

function parseAllSetCookie(res: Response): string[] {
  const got = res.headers.getSetCookie?.() ?? [];
  if (got.length > 0) return got;
  const raw = res.headers.get("set-cookie") ?? "";
  if (!raw) return [];
  return raw.split(/, (?=[A-Za-z_][A-Za-z0-9_-]*=)/);
}
async function login(email: string, password: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfJson = await csrfRes.json();
  const c1 = parseAllSetCookie(csrfRes).find(c => /authjs\.csrf-token=/.test(c));
  if (!c1) throw new Error("CSRF cookie missing");
  const jar = c1.split(";")[0];
  const r = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar },
    body: new URLSearchParams({
      email, password,
      csrfToken: csrfJson.csrfToken,
      callbackUrl: `${BASE}/admin`,
      json: "true",
    }).toString(),
    redirect: "manual",
  });
  const sc = parseAllSetCookie(r).find(c => /authjs\.session-token=/.test(c) && !/Max-Age=0/.test(c));
  if (!sc) throw new Error(`Login failed for ${email}: ${r.status}`);
  return [jar, sc.split(";")[0]].join("; ");
}

async function main() {
  console.log("📋 Tier 게이팅 + 퇴점 처리 E2E\n");

  console.log("[A] tier 게이팅");
  // basic tier 협력점(bundang-rental)이 display-config PATCH 시도 → 403
  const bundangCookie = await login("bundang@rentking.kr", "demo1234");
  const dispRes = await fetch(`${BASE}/api/franchise/display-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: bundangCookie },
    body: JSON.stringify({ picks: [] }),
  });
  if (dispRes.status === 403) ok("basic tier → display-config PATCH 거부 (403)");
  else ko("basic tier display-config", `status=${dispRes.status}`);

  const bannerRes = await fetch(`${BASE}/api/franchise/banners`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: bundangCookie },
    body: JSON.stringify({
      title: "테스트 배너",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  });
  if (bannerRes.status === 403) ok("basic tier → banner POST 거부 (403)");
  else ko("basic tier banner POST", `status=${bannerRes.status}`);

  // standard+ 협력점(gangnam=premium)는 통과
  const gangnamCookie = await login("gangnam@rentking.kr", "demo1234");
  const dispRes2 = await fetch(`${BASE}/api/franchise/display-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: gangnamCookie },
    body: JSON.stringify({ picks: [], ranking: {} }),
  });
  if (dispRes2.ok) ok("premium tier → display-config PATCH 통과");
  else ko("premium display-config", `status=${dispRes2.status}`);

  console.log("\n[B] HQ tier 변경");
  const hqCookie = await login("hq@rentking.kr", "demo1234");
  const tierRes = await fetch(`${BASE}/api/admin/partners/bundang-rental`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: hqCookie },
    body: JSON.stringify({ action: "setTier", tier: "standard" }),
  });
  if (tierRes.ok) ok("HQ tier 변경 bundang basic→standard");
  else ko("tier 변경", `status=${tierRes.status}`);

  // 변경 후 다시 basic으로 복원
  const restoreTier = await fetch(`${BASE}/api/admin/partners/bundang-rental`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: hqCookie },
    body: JSON.stringify({ action: "setTier", tier: "basic" }),
  });
  if (restoreTier.ok) ok("tier 복원 standard→basic");
  else ko("tier 복원", `status=${restoreTier.status}`);

  console.log("\n[C] 퇴점 처리 시뮬레이션 (bundang-rental 대상)");
  // 먼저 테스트 lead 1건 만들기 (bundang-rental 소속)
  const phone = `0103${Math.floor(Math.random() * 9000000 + 1000000)}`;
  const customerName = `퇴점테스트${Math.floor(Math.random() * 9000) + 1000}`;
  const leadRes = await fetch(`${BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName, phone,
      productInterest: "테스트 정수기",
      partnerId: "bundang-rental",
      landingType: "consumer_partner",
    }),
  });
  const leadJson = await leadRes.json();
  const leadId: string | undefined = leadJson.leadId;
  if (!leadId) { ko("테스트 lead 생성", JSON.stringify(leadJson)); return; }
  ok("테스트 lead 생성 (bundang-rental 소속)");

  // 퇴점 처리
  const closeRes = await fetch(`${BASE}/api/admin/partners/bundang-rental`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: hqCookie },
    body: JSON.stringify({ action: "close" }),
  });
  const closeJson = await closeRes.json();
  if (closeRes.ok) {
    ok("HQ 퇴점 처리", `lead 인계 ${closeJson.handedOverLeads}건, 영업자 ${closeJson.deactivatedSellers}명 비활성`);
  } else {
    ko("퇴점 처리", JSON.stringify(closeJson));
    return;
  }

  // DB로 직접 검증
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead?.partnerId === null && lead?.ownerType === "hq_pool") ok("lead 본사 풀 이전 확인", `partnerId=null ownerType=hq_pool`);
    else ko("lead 인계", `partnerId=${lead?.partnerId} ownerType=${lead?.ownerType}`);

    const closedPartner = await prisma.partner.findUnique({ where: { partnerCode: "bundang-rental" } });
    if (closedPartner?.status === "closed" && closedPartner.closedAt) ok("partner.status=closed + closedAt 기록");
    else ko("partner 상태", `status=${closedPartner?.status} closedAt=${closedPartner?.closedAt}`);

    const inactiveSellers = await prisma.seller.count({ where: { partnerId: "bundang-rental", status: "inactive" } });
    if (inactiveSellers > 0) ok(`영업자 비활성화 (${inactiveSellers}명)`);

    // 퇴점 협력점 사이트 응답 — 404 기대
    const siteRes = await fetch(`${BASE}/p/bundang-rental`, { redirect: "manual" });
    if (siteRes.status === 404) ok("퇴점 협력점 사이트 404");
    else ko("퇴점 사이트", `status=${siteRes.status}`);

    // 퇴점 협력점 코드로 lead 신청 시도 → hq_pool로 강제 전환
    const fbLead = await fetch(`${BASE}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `폴백테스트${Math.floor(Math.random() * 1000)}`,
        phone: `0102${Math.floor(Math.random() * 9000000 + 1000000)}`,
        productInterest: "테스트",
        partnerId: "bundang-rental",
        landingType: "consumer_partner",
      }),
    });
    const fbJson = await fbLead.json();
    if (fbLead.ok && fbJson.ownerType === "hq_pool") ok("퇴점 협력점 신청 → hq_pool fallback");
    else ko("hq_pool fallback", `${JSON.stringify(fbJson).slice(0, 100)}`);
    // 폴백 lead 정리
    if (fbJson.leadId) await prisma.lead.deleteMany({ where: { id: fbJson.leadId } });

    console.log("\n[D] 재활성화");
    const reopenRes = await fetch(`${BASE}/api/admin/partners/bundang-rental`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: hqCookie },
      body: JSON.stringify({ action: "reopen" }),
    });
    if (reopenRes.ok) ok("재활성화 처리");
    else ko("재활성화", `status=${reopenRes.status}`);

    // 영업자/배너는 자동 복원 안 됨 — 협력점 admin이 직접
    await prisma.seller.updateMany({ where: { partnerId: "bundang-rental" }, data: { status: "active" } });

    // 테스트 lead 정리 + 인계 메모는 남김
    await prisma.leadStatusLog.deleteMany({ where: { leadId } });
    await prisma.lead.deleteMany({ where: { id: leadId } });
    console.log(`\n  ✓ 정리 — 테스트 lead 1건 + 영업자 활성 복원`);

  } finally {
    await prisma.$disconnect();
  }

  const total = results.length, okN = results.filter(r => r.ok).length;
  console.log(`\n${"━".repeat(50)}`);
  console.log(`최종: 통과 ${okN} / 실패 ${total - okN}`);
  if (okN < total) process.exit(1);
}

main().catch(e => { console.error("\n예외:", e); process.exit(1); });
