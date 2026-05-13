/**
 * 분양 흐름 end-to-end 테스트:
 * 1. 소비자가 협력점 상품 페이지에서 상담 신청 (POST /api/leads, 익명)
 * 2. 협력점이 자기 콘솔에서 lead 확인 (GET /api/leads, partner_admin auth)
 * 3. 협력점이 status를 new → going (주문확인) → done (설치완료)
 * 4. status=done 시 Settlement 자동 생성 확인
 * 5. Settlement에 정확한 productCode + 본사 수수료 합계 반영 확인
 *
 * 모든 단계가 production URL에서 실행됨.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const BASE = "https://rentking-next.vercel.app";

type Step = { name: string; ok: boolean; detail: string };
const steps: Step[] = [];

const pass = (name: string, detail: string) => {
  steps.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}: ${detail}`);
};
const fail = (name: string, detail: string) => {
  steps.push({ name, ok: false, detail });
  console.log(`  ✗ ${name}: ${detail}`);
};

// undici의 fetch는 set-cookie가 여러 개일 때 배열로 안 주고 쉼표로 합쳐버린다.
// 대신 raw header를 정규식으로 파싱.
function parseAllSetCookie(res: Response): string[] {
  // Node 22+ 의 getSetCookie는 빈 배열을 줄 수 있어서 fallback으로 raw 헤더 직접 분리
  const got = res.headers.getSetCookie?.() ?? [];
  if (got.length > 0) return got;
  const raw = res.headers.get("set-cookie") ?? "";
  if (!raw) return [];
  // ", " 가 cookie 분리자지만 Expires=Tue, 09 Jun ... 의 ", " 와 충돌. ", \w+=" 패턴 사용.
  const cookies: string[] = [];
  let buf = "";
  const parts = raw.split(/, (?=[A-Za-z_][A-Za-z0-9_-]*=)/);
  for (const p of parts) cookies.push(p);
  return cookies;
}

async function csrfThenSignin(email: string, password: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfJson = await csrfRes.json();
  const setCookie1 = parseAllSetCookie(csrfRes);
  const csrfCookie = setCookie1.find(c => /authjs\.csrf-token=/.test(c));
  if (!csrfCookie) throw new Error(`CSRF cookie not found in ${JSON.stringify(setCookie1)}`);
  const cookieJar = csrfCookie.split(";")[0];

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieJar },
    body: new URLSearchParams({
      email, password,
      csrfToken: csrfJson.csrfToken,
      callbackUrl: `${BASE}/admin`,
      json: "true",
    }).toString(),
    redirect: "manual",
  });
  const setCookie2 = parseAllSetCookie(res);
  const sessionCookie = setCookie2.find(c => /authjs\.session-token=/.test(c) && !/Max-Age=0/.test(c));
  if (!sessionCookie) {
    throw new Error(`Login failed: status=${res.status} cookies=${JSON.stringify(setCookie2)}`);
  }
  return [cookieJar, sessionCookie.split(";")[0]].join("; ");
}

async function main() {
  console.log("📋 분양 흐름 E2E 테스트\n");

  // === 단계 1: 익명 소비자가 lead 제출 ===
  console.log("[1] 소비자 — 상담 신청 폼 제출");
  const customerName = `테스트${Math.floor(Math.random() * 9000) + 1000}`;
  const phone = "01012345678";
  const productCode = "WPUJCC104SWH"; // 초소형 직수 정수기 (멀티 모드 상품)
  const productLabel = "초소형 직수 정수기 (방문형 60개월 카드할인가)";
  const partnerId = "gangnam-skmagic";

  const leadRes = await fetch(`${BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName,
      phone,
      productInterest: productLabel,
      productCode,
      region: "강남구 역삼동",
      partnerId,
      landingType: "consumer_partner",
      utm: { source: "test", campaign: "e2e" },
      landingPath: `/p/${partnerId}/products/${productCode}`,
      deviceType: "desktop",
      // PriceConfigurator 시뮬레이션 — 60개월 방문형 + 타사보상 적용
      selectedMode: "방문형",
      selectedContractPeriod: 60,
      selectedRentalPrice: 36900,
      selectedCardDiscountPrice: 29400,
      rivalCompensationRequested: true,
    }),
  });
  const leadJson = await leadRes.json();
  const leadId: string | undefined = leadJson.leadId ?? leadJson.id;
  if (!leadRes.ok || !leadId) {
    fail("lead POST", `${leadRes.status} ${JSON.stringify(leadJson)}`);
    return;
  }
  pass("lead POST (익명 폼)", `id=${leadId} owner=${leadJson.assignedPartnerId} type=${leadJson.ownerType}`);

  // === 단계 2: 협력점 admin 로그인 ===
  console.log("\n[2] 협력점 — 콘솔 로그인");
  let partnerCookie: string;
  try {
    partnerCookie = await csrfThenSignin("gangnam@rentking.kr", "demo1234");
    pass("partner login", "session-token 획득");
  } catch (e) {
    fail("partner login", e instanceof Error ? e.message : String(e));
    return;
  }

  // === 단계 3: 협력점 lead 목록 확인 ===
  console.log("\n[3] 협력점 — lead 목록에서 새 lead 확인");
  const listRes = await fetch(`${BASE}/api/leads`, { headers: { Cookie: partnerCookie } });
  if (!listRes.ok) {
    fail("lead list GET", `${listRes.status}`);
    return;
  }
  const listJson = await listRes.json();
  const found = listJson.leads?.find((l: { id: string }) => l.id === leadId);
  if (!found) {
    fail("lead list GET", `방금 만든 lead가 협력점 목록에 없음`);
    return;
  }
  pass("lead 목록", `${listJson.leads.length}건 중 우리 lead 확인 (${found.customerName})`);

  // === 단계 4: 협력점 status 전이 (consult_wish → consult_active → apply_submitted) ===
  console.log("\n[4] 협력점 — status 전이 (상담 → 신청)");
  for (const next of ["consult_active", "apply_submitted"] as const) {
    const r = await fetch(`${BASE}/api/leads/${leadId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: partnerCookie },
      body: JSON.stringify({ status: next }),
    });
    const j = await r.json();
    if (!r.ok) { fail(`status → ${next}`, JSON.stringify(j)); return; }
    pass(`status → ${next}`, `applied (chain logs ${(j.logs?.length ?? 1)}건)`);
  }

  // === 단계 4-2: 본사가 인증/설치/정산 처리 ===
  console.log("\n[4-2] 본사 — 인증 → 설치 → 정산");
  const hqCookie = await csrfThenSignin("hq@rentking.kr", "demo1234");
  for (const next of ["verify_passed", "install_done", "settle_done"] as const) {
    const r = await fetch(`${BASE}/api/leads/${leadId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: hqCookie },
      body: JSON.stringify({ status: next }),
    });
    const j = await r.json();
    if (!r.ok) { fail(`HQ status → ${next}`, JSON.stringify(j)); return; }
    pass(`HQ status → ${next}`, `applied (chain ${(j.logs?.length ?? 1)}건)`);
  }

  // === 단계 5: Settlement 자동 생성 확인 (DB 직접 조회) ===
  console.log("\n[5] DB — Settlement 자동 생성 확인");
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { fail("Settlement check", "DATABASE_URL 없음"); return; }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { settlement: true, statusLogs: { orderBy: { createdAt: "asc" } } },
    });
    if (!lead) { fail("lead refetch", "lead 사라짐"); return; }
    pass("lead 최종 상태", `status=${lead.status}, statusLogs=${lead.statusLogs.length}건`);

    // 옵션이 lead에 정확히 저장됐는지
    const opts: string[] = [];
    if (lead.selectedMode === "방문형") opts.push("mode=방문형 ✓");
    else opts.push(`mode=${lead.selectedMode} ✗`);
    if (lead.selectedContractPeriod === 60) opts.push("60개월 ✓");
    else opts.push(`period=${lead.selectedContractPeriod} ✗`);
    if (lead.selectedRentalPrice === 36900) opts.push("rental ✓");
    else opts.push(`rental=${lead.selectedRentalPrice} ✗`);
    if (lead.rivalCompensationRequested === true) opts.push("타사보상 ✓");
    else opts.push("타사보상 ✗");
    const allOk = !opts.some(o => o.includes("✗"));
    if (allOk) pass("Lead 옵션 저장", opts.join(", "));
    else fail("Lead 옵션 저장 일부 누락", opts.join(", "));

    if (!lead.settlement) {
      fail("Settlement 자동 생성", "status=done인데 settlement이 만들어지지 않음 ⚠");
    } else {
      const s = lead.settlement;
      pass("Settlement 자동 생성", `id=${s.id} 상품=${s.productName} 수수료=₩${s.baseCommission.toLocaleString()} 순수령=₩${s.netPayout.toLocaleString()}`);

      // 수수료가 시트의 정책 commission과 일치하는지 검증
      // (Settlement에는 baseCommission + monthIncentive 합계가 저장됨)
      const product = await prisma.product.findUnique({
        where: { productCode: s.productCode! },
        include: { hqPolicy: true },
      });
      if (product?.hqPolicy) {
        const expected = product.hqPolicy.baseCommission + product.hqPolicy.monthIncentive;
        if (s.baseCommission === expected) {
          pass("정산 수수료 정확성", `${s.baseCommission.toLocaleString()}원 = base ${product.hqPolicy.baseCommission.toLocaleString()} + incent ${product.hqPolicy.monthIncentive.toLocaleString()}`);
        } else {
          fail("정산 수수료 불일치", `Settlement=${s.baseCommission} vs (base+incent)=${expected}`);
        }
      }
    }

    // 상태 로그 확인
    if (lead.statusLogs.length >= 2) {
      pass("LeadStatusLog 기록", lead.statusLogs.map(l => `${l.previousStatus}→${l.newStatus}`).join(", "));
    }

    console.log("\n=== 정리 — 테스트 lead 삭제 ===");
    if (lead.settlement) {
      await prisma.settlement.delete({ where: { leadId } });
    }
    await prisma.leadStatusLog.deleteMany({ where: { leadId } });
    await prisma.lead.delete({ where: { id: leadId } });
    console.log(`  ✓ lead ${leadId} 및 관련 데이터 삭제`);

  } finally {
    await prisma.$disconnect();
  }

  // === 결과 요약 ===
  const ok = steps.filter(s => s.ok).length;
  const ko = steps.filter(s => !s.ok).length;
  console.log(`\n${"━".repeat(50)}`);
  console.log(`최종: 통과 ${ok}건 / 실패 ${ko}건`);
  if (ko > 0) {
    console.log("\n실패 항목:");
    for (const s of steps.filter(x => !x.ok)) console.log(`  - ${s.name}: ${s.detail}`);
    process.exit(1);
  }
}

main().catch(e => { console.error("\n🛑 예외 발생:", e); process.exit(1); });
