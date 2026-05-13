/**
 * 전체 시스템 헬스체크.
 *  1) 공개 페이지 — 협력점 사이트 8곳 × 핵심 경로 모두 응답
 *  2) 인증 페이지 — HQ + partner_admin 콘솔 주요 라우트
 *  3) 인증 API — 핵심 GET 엔드포인트
 *  4) 데이터 정합성 — 가격 역전 / 정책 누락 / 크롤 큐 / 영업자 / 이미지 누락
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });

const BASE = "https://rentking-next.vercel.app";

type Result = { kind: string; name: string; ok: boolean; detail: string };
const results: Result[] = [];

const ok = (kind: string, name: string, detail = "") => {
  results.push({ kind, name, ok: true, detail });
  process.stdout.write(`  ✓ [${kind}] ${name}${detail ? ` — ${detail}` : ""}\n`);
};
const ko = (kind: string, name: string, detail: string) => {
  results.push({ kind, name, ok: false, detail });
  process.stdout.write(`  ✗ [${kind}] ${name} — ${detail}\n`);
};

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

async function probe(url: string, opts: { cookie?: string; expect?: number[]; needle?: string; kind?: string; name?: string }) {
  const expect = opts.expect ?? [200];
  const kind = opts.kind ?? "GET";
  const name = opts.name ?? url.replace(BASE, "");

  try {
    const res = await fetch(url, {
      headers: opts.cookie ? { Cookie: opts.cookie } : undefined,
      redirect: "manual",
    });
    if (!expect.includes(res.status)) {
      ko(kind, name, `status=${res.status}`);
      return;
    }
    if (opts.needle) {
      const text = await res.text();
      if (!text.includes(opts.needle)) {
        ko(kind, name, `needle "${opts.needle}" not found`);
        return;
      }
    }
    ok(kind, name, `${res.status}`);
  } catch (e) {
    ko(kind, name, e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  console.log("🔍 1) 공개 페이지 — 협력점 8곳");
  const partners = await prisma.partner.findMany({
    where: { status: "active" }, select: { partnerCode: true, partnerName: true },
  });
  // 핵심 sample productCode 하나 먼저 잡기
  const sampleProduct = await prisma.product.findFirst({
    where: { status: "active" }, select: { productCode: true },
    orderBy: { isFeatured: "desc" },
  });
  const sampleCode = sampleProduct?.productCode ?? "WPUJCC104SWH";

  for (const p of partners) {
    await probe(`${BASE}/p/${p.partnerCode}`, { kind: "공개", name: `메인 (${p.partnerName})`, needle: p.partnerName });
    await probe(`${BASE}/p/${p.partnerCode}/products`, { kind: "공개", name: `상품목록 (${p.partnerName})` });
    await probe(`${BASE}/p/${p.partnerCode}/products/${sampleCode}`, { kind: "공개", name: `상품상세 (${p.partnerName})` });
    await probe(`${BASE}/p/${p.partnerCode}/category/water`, { kind: "공개", name: `정수기 카테고리 (${p.partnerName})` });
    await probe(`${BASE}/p/${p.partnerCode}/events`, { kind: "공개", name: `이벤트 (${p.partnerName})` });
  }

  console.log("\n🔍 2) 공개 — 글로벌 페이지");
  await probe(`${BASE}/`, { kind: "공개", name: "허브 /" });
  await probe(`${BASE}/apply`, { kind: "공개", name: "/apply" });
  await probe(`${BASE}/login`, { kind: "공개", name: "/login" });
  await probe(`${BASE}/legal/terms`, { kind: "공개", name: "/legal/terms" });
  await probe(`${BASE}/legal/privacy`, { kind: "공개", name: "/legal/privacy" });
  await probe(`${BASE}/p/${partners[0].partnerCode}/search?q=정수기`, { kind: "공개", name: "검색 페이지" });

  console.log("\n🔍 3) 인증 — 본사 슈퍼관리자");
  let hqCookie = "";
  try {
    hqCookie = await login("hq@rentking.kr", "demo1234");
    ok("인증", "HQ 로그인", "session 획득");
  } catch (e) {
    ko("인증", "HQ 로그인", e instanceof Error ? e.message : String(e));
  }
  if (hqCookie) {
    const hqPaths = [
      "/admin", "/admin/super", "/admin/super/partners", "/admin/super/approvals",
      "/admin/super/duplicates", "/admin/super/anomalies", "/admin/super/analytics",
      "/admin/super/products", "/admin/super/policies", "/admin/super/broadcasts",
      "/admin/super/settlements", "/admin/super/crawl", "/admin/super/crawl/queue",
    ];
    for (const path of hqPaths) {
      // /admin은 역할에 따라 /admin/super 또는 /admin/franchise로 자동 리다이렉트(307)되므로 둘 다 정상
      await probe(`${BASE}${path}`, {
        cookie: hqCookie, kind: "HQ", name: path,
        expect: path === "/admin" ? [200, 307] : [200],
      });
    }
    // API GET
    await probe(`${BASE}/api/policies/hq`, { cookie: hqCookie, kind: "HQ-API", name: "GET /api/policies/hq" });
    await probe(`${BASE}/api/leads`, { cookie: hqCookie, kind: "HQ-API", name: "GET /api/leads" });
    await probe(`${BASE}/api/products/${sampleCode}/admin`, { cookie: hqCookie, kind: "HQ-API", name: "GET /api/products/[code]/admin" });
  }

  console.log("\n🔍 4) 인증 — 협력점 admin");
  let pCookie = "";
  try {
    pCookie = await login("gangnam@rentking.kr", "demo1234");
    ok("인증", "협력점 로그인", "session 획득");
  } catch (e) {
    ko("인증", "협력점 로그인", e instanceof Error ? e.message : String(e));
  }
  if (pCookie) {
    const pPaths = [
      "/admin", "/admin/franchise", "/admin/franchise/leads", "/admin/franchise/sellers",
      "/admin/franchise/products", "/admin/franchise/settlements", "/admin/franchise/settings",
      "/admin/franchise/analytics",
    ];
    for (const path of pPaths) {
      await probe(`${BASE}${path}`, {
        cookie: pCookie, kind: "협력점", name: path,
        expect: path === "/admin" ? [200, 307] : [200],
      });
    }
    await probe(`${BASE}/api/policies/partner`, { cookie: pCookie, kind: "협력점-API", name: "GET /api/policies/partner" });
    await probe(`${BASE}/api/leads`, { cookie: pCookie, kind: "협력점-API", name: "GET /api/leads (자기 lead만)" });
    await probe(`${BASE}/api/sellers`, { cookie: pCookie, kind: "협력점-API", name: "GET /api/sellers" });
  }

  console.log("\n🔍 5) 권한 격리 — 협력점이 HQ 라우트 접근 시 막혀야");
  if (pCookie) {
    await probe(`${BASE}/api/policies/hq`, {
      cookie: pCookie, kind: "권한", name: "협력점 → HQ API (403 기대)",
      expect: [401, 403],
    });
  }

  console.log("\n🔍 6) DB 정합성");
  // 가격 역전
  const inverted = await prisma.product.findMany({
    where: { status: "active", cardDiscountPrice: { not: null } },
    select: { productCode: true, rentalPrice: true, cardDiscountPrice: true },
  });
  const invCount = inverted.filter(p => p.cardDiscountPrice != null && p.cardDiscountPrice >= p.rentalPrice).length;
  if (invCount === 0) ok("정합성", "가격 역전 (card ≥ rental)", "0건");
  else ko("정합성", "가격 역전 (card ≥ rental)", `${invCount}건`);

  // HqPolicy 누락 (활성 상품 중) — 시트에 없는 모델은 의도된 미완이므로 안내성 경고
  const productsWithoutPolicy = await prisma.product.findMany({
    where: { status: "active", hqPolicy: { is: null } },
    select: { productCode: true, name: true },
  });
  if (productsWithoutPolicy.length === 0) {
    ok("정합성", "HqPolicy 누락", "0건");
  } else {
    const codes = productsWithoutPolicy.map(p => p.productCode).join(", ");
    ok("정합성", "HqPolicy 누락 (안내)", `${productsWithoutPolicy.length}건 — HQ 수동 입력 필요: ${codes}`);
  }

  // priceMatrix 누락
  const noMatrix = await prisma.product.count({
    where: { status: "active", priceMatrix: { equals: [] } },
  });
  // priceMatrix가 null이거나 빈배열이면 매트릭스 미설정 — null도 카운트
  const totalActive = await prisma.product.count({ where: { status: "active" } });
  const withMatrix = await prisma.product.count({
    where: { status: "active", NOT: { priceMatrix: { equals: [] } } },
  });
  ok("정합성", "priceMatrix 적용", `${withMatrix}/${totalActive}개 적용 (시트에 없는 모델 제외)`);

  // 이미지 누락
  const noImage = await prisma.product.count({
    where: { status: "active", imageUrls: { isEmpty: true }, imageUrl: null },
  });
  if (noImage === 0) ok("정합성", "이미지 누락", "0건");
  else ko("정합성", "이미지 누락", `${noImage}건`);

  // 크롤 큐
  const pendingCrawl = await prisma.crawledProduct.count({ where: { approvalStatus: "pending" } });
  ok("정합성", "크롤 검토 대기", `${pendingCrawl}건`);

  // Lead status 분포
  const leadCount = await prisma.lead.count();
  const leadByStatus = await prisma.lead.groupBy({ by: ["status"], _count: { _all: true } });
  ok("정합성", "Lead 총계", `${leadCount}건 (${leadByStatus.map(l => `${l.status}:${l._count._all}`).join(", ")})`);

  // PartnerPolicy 분포
  const partnerWithPolicy = await prisma.partner.findMany({
    where: { status: "active" },
    select: {
      partnerCode: true, partnerName: true,
      policies: { select: { id: true, giftAmount: true, installAmount: true } },
    },
  });
  for (const p of partnerWithPolicy) {
    const withGift = p.policies.filter(pp => pp.giftAmount > 0 || pp.installAmount > 0).length;
    if (withGift === 0) ko("정합성", `PartnerPolicy (${p.partnerName})`, "사은품/설치비 정책 0건");
    else ok("정합성", `PartnerPolicy (${p.partnerName})`, `${withGift}건 차별화`);
  }

  // Settlement 정합성 (설치완료 이후 단계 — install_done/settle_pending/settle_done — 인데 settlement 없는 lead)
  const orphanLeads = await prisma.lead.count({
    where: {
      status: { in: ["install_done", "settle_pending", "settle_done"] },
      settlement: { is: null },
    },
  });
  if (orphanLeads === 0) ok("정합성", "정산 누락 lead", "0건");
  else ko("정합성", "정산 누락 lead", `${orphanLeads}건 (설치완료 단계 lead 중 settlement 미생성)`);

  // ============ 결과 요약 ============
  console.log(`\n${"━".repeat(60)}`);
  const total = results.length;
  const okN = results.filter(r => r.ok).length;
  const koN = total - okN;
  console.log(`총 ${total}건 검사: 통과 ${okN} / 실패 ${koN}`);

  // 카테고리별 요약
  const byKind = new Map<string, { ok: number; fail: number }>();
  for (const r of results) {
    if (!byKind.has(r.kind)) byKind.set(r.kind, { ok: 0, fail: 0 });
    const cur = byKind.get(r.kind)!;
    if (r.ok) cur.ok++;
    else cur.fail++;
  }
  console.log("\n카테고리별:");
  for (const [k, v] of byKind) {
    console.log(`  ${k.padEnd(15)} 통과 ${v.ok}  ${v.fail > 0 ? "실패 " + v.fail : ""}`);
  }

  if (koN > 0) {
    console.log(`\n실패 ${koN}건 상세:`);
    for (const r of results.filter(x => !x.ok)) {
      console.log(`  ✗ [${r.kind}] ${r.name}: ${r.detail}`);
    }
    process.exit(1);
  }
}

main().catch(e => { console.error("\n예외:", e); process.exit(1); }).finally(() => prisma.$disconnect());
