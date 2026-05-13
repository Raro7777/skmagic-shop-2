/**
 * 영업자 콘솔 E2E 검증:
 *  1) 영업자 로그인 (seller role)
 *  2) /admin → /admin/seller 자동 리다이렉트
 *  3) /admin/seller, /admin/seller/leads, /admin/seller/links 모두 200
 *  4) /admin/super, /admin/franchise 접근 시 자기 home으로 redirect
 *  5) 자기 lead 1건 만들고 (sellerId 매핑) status going → done 전이
 *  6) 다른 영업자의 lead는 수정 거부 (403)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const BASE = "https://rentking-next.vercel.app";
const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const ok = (name: string, detail = "") => { results.push({ name, ok: true, detail }); console.log(`  ✓ ${name}${detail ? " — " + detail : ""}`); };
const ko = (name: string, detail: string) => { results.push({ name, ok: false, detail }); console.log(`  ✗ ${name} — ${detail}`); };

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
  console.log("📋 영업자 콘솔 E2E\n");

  // [1] 영업자 로그인
  console.log("[1] 영업자 로그인 (박지민 — 강남)");
  let cookie: string;
  try {
    cookie = await login("park-jimin@gangnam-skmagic.seller", "demo1234");
    ok("seller 로그인", "session-token 획득");
  } catch (e) {
    ko("seller 로그인", e instanceof Error ? e.message : String(e));
    return;
  }

  // [2] /admin → /admin/seller 리다이렉트
  console.log("\n[2] /admin 진입 → 자동 라우팅");
  const adminRes = await fetch(`${BASE}/admin`, { headers: { Cookie: cookie }, redirect: "manual" });
  const loc = adminRes.headers.get("location") ?? "";
  if ((adminRes.status === 307 || adminRes.status === 308) && loc.includes("/admin/seller")) {
    ok("/admin → /admin/seller redirect", `${adminRes.status} → ${loc}`);
  } else {
    ko("/admin redirect", `status=${adminRes.status} loc=${loc}`);
  }

  // [3] seller 콘솔 라우트
  console.log("\n[3] 영업자 콘솔 라우트");
  for (const path of ["/admin/seller", "/admin/seller/leads", "/admin/seller/links"]) {
    const r = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie }, redirect: "manual" });
    if (r.status === 200) ok(path, "200");
    else ko(path, `status=${r.status}`);
  }

  // [4] 권한 격리 — super/franchise 접근 시 자기 home으로 redirect
  console.log("\n[4] 권한 격리");
  for (const path of ["/admin/super", "/admin/franchise"]) {
    const r = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie }, redirect: "manual" });
    const targetLoc = r.headers.get("location") ?? "";
    if ((r.status === 307 || r.status === 308) && targetLoc.includes("/admin/seller")) {
      ok(`${path} → /admin/seller`, `${r.status}`);
    } else {
      ko(`${path} 격리`, `status=${r.status} loc=${targetLoc}`);
    }
  }

  // [5] 자기 lead 만들고 처리
  console.log("\n[5] sellerCode 매핑된 lead 처리");
  const customerName = `영업자테스트${Math.floor(Math.random() * 9000) + 1000}`;
  const phone = "01099887766";
  const leadRes = await fetch(`${BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName,
      phone,
      productInterest: "초소형 직수 정수기 (영업자 링크 유입)",
      productCode: "WPUJCC104SWH",
      region: "서초구",
      partnerId: "gangnam-skmagic",
      sellerCode: "park-jimin",
      landingType: "consumer_seller",
      selectedMode: "방문형",
      selectedContractPeriod: 60,
      selectedRentalPrice: 36900,
    }),
  });
  const leadJson = await leadRes.json();
  const leadId: string | undefined = leadJson.leadId;
  if (!leadId) { ko("lead 생성", JSON.stringify(leadJson)); return; }
  ok("lead 생성 (sellerCode park-jimin)", `id=${leadId}`);

  // 영업자가 직접 status 전이 (consult_wish → consult_active → apply_submitted)
  for (const next of ["consult_active", "apply_submitted"] as const) {
    const r = await fetch(`${BASE}/api/leads/${leadId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ status: next }),
    });
    if (!r.ok) { ko(`status → ${next}`, `${r.status}`); return; }
    ok(`status → ${next}`, "OK");
  }

  // install_done 은 본사 전담 → 영업자 시도 시 403
  const installBlock = await fetch(`${BASE}/api/leads/${leadId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ status: "install_done" }),
  });
  if (installBlock.status === 403) ok("영업자 install_done 차단 (403)", "본사 전담 권한 정상");
  else ko("영업자 install_done 차단", `status=${installBlock.status}`);

  // [6] 다른 영업자의 lead는 수정 거부
  console.log("\n[6] 권한 격리 — 다른 영업자 lead 시도");
  // 다른 영업자 lead를 직접 만들어 본인 영업자가 수정 시도
  const otherLeadRes = await fetch(`${BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: `다른영업자테스트${Math.floor(Math.random() * 9000)}`,
      phone: "01088997755",
      productInterest: "다른 영업자 lead",
      productCode: "WPUJCC104SWH",
      region: "강남",
      partnerId: "gangnam-skmagic",
      sellerCode: "kim-younghee", // 다른 영업자
      landingType: "consumer_seller",
    }),
  });
  const otherLeadJson = await otherLeadRes.json();
  const otherLeadId: string | undefined = otherLeadJson.leadId;
  if (!otherLeadId) { ko("다른 영업자 lead 생성", JSON.stringify(otherLeadJson)); return; }
  ok("다른 영업자 lead 생성", `id=${otherLeadId}`);

  const blockRes = await fetch(`${BASE}/api/leads/${otherLeadId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ status: "consult_active" }),
  });
  if (blockRes.status === 403) {
    ok("다른 영업자 lead 수정 차단 (403)", "권한 격리 정상");
  } else {
    ko("다른 영업자 lead 수정", `차단 안됨: status=${blockRes.status}`);
  }

  // 정리 — 두 lead 모두 삭제
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    for (const id of [leadId, otherLeadId]) {
      await prisma.settlement.deleteMany({ where: { leadId: id } });
      await prisma.leadStatusLog.deleteMany({ where: { leadId: id } });
      await prisma.lead.deleteMany({ where: { id } });
    }
    console.log(`\n  ✓ 테스트 lead 2건 정리`);
  } finally {
    await prisma.$disconnect();
  }

  // 요약
  const total = results.length, okN = results.filter(r => r.ok).length;
  console.log(`\n${"━".repeat(50)}`);
  console.log(`최종: 통과 ${okN} / 실패 ${total - okN}`);
  if (okN < total) process.exit(1);
}

main().catch(e => { console.error("\n예외:", e); process.exit(1); });
