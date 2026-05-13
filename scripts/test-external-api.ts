/**
 * 외부 사이트 입장에서 우리 API를 호출하는 E2E:
 *   1. 인증 없이 호출 → 401
 *   2. 잘못된 키 → 401
 *   3. 카테고리 제한 채널이 다른 카테고리 시도 → 403
 *   4. 정상 키 → 상품 목록 (가격/사은품/스펙/이미지/약정옵션 포함)
 *   5. 외부 lead POST → 본사 풀(hq_pool)로 분류
 *   6. 본사 직영 사이트 응답 — 200
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE = "https://rentking-next.vercel.app";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const ok = (n: string, d = "") => { results.push({ name: n, ok: true, detail: d }); console.log(`  ✓ ${n}${d ? " — " + d : ""}`); };
const ko = (n: string, d: string) => { results.push({ name: n, ok: false, detail: d }); console.log(`  ✗ ${n} — ${d}`); };

async function main() {
  console.log("📋 외부 API 채널 E2E\n");

  // 인증 키 가져오기 (직접 DB에서)
  const fullPartner = await prisma.apiPartner.findUnique({ where: { slug: "demo-mall" } });
  const waterOnly = await prisma.apiPartner.findUnique({ where: { slug: "water-only" } });
  if (!fullPartner || !waterOnly) { ko("API partner 조회", "시드 안 됨"); return; }
  const fullKey = fullPartner.apiKey;
  const waterKey = waterOnly.apiKey;

  // [1] 인증 없음
  let r = await fetch(`${BASE}/api/external/products`);
  if (r.status === 401) ok("인증 없음 → 401");
  else ko("인증 없음", `status=${r.status}`);

  // [2] 잘못된 키
  r = await fetch(`${BASE}/api/external/products`, { headers: { Authorization: "Bearer rk_wrongkey1234567890123456789" } });
  if (r.status === 401) ok("잘못된 키 → 401");
  else ko("잘못된 키", `status=${r.status}`);

  // [3] water-only 채널이 air 카테고리 시도 → 403
  r = await fetch(`${BASE}/api/external/products?category=air`, { headers: { Authorization: `Bearer ${waterKey}` } });
  if (r.status === 403) ok("water-only → category=air 거부 (403)");
  else ko("카테고리 권한 검사", `status=${r.status}`);

  // [4] 정상 키 — 전체 허용 채널
  r = await fetch(`${BASE}/api/external/products?limit=5`, { headers: { Authorization: `Bearer ${fullKey}` } });
  if (r.ok) {
    const j = await r.json();
    if (j.total > 0 && j.products.length > 0) {
      const sample = j.products[0];
      const hasAllFields = sample.productCode && sample.name && typeof sample.rentalPrice === "number"
        && Array.isArray(sample.imageUrls) && Array.isArray(sample.priceMatrix);
      if (hasAllFields) ok(`상품 조회`, `${j.products.length}/${j.total}건, sample: ${sample.productCode} ₩${sample.rentalPrice.toLocaleString()}`);
      else ko("상품 응답 필드 누락", JSON.stringify(sample).slice(0, 200));
    } else { ko("상품 응답 비어있음", JSON.stringify(j).slice(0, 100)); }
  } else { ko("상품 조회", `status=${r.status}`); }

  // [5] water-only 채널 — water 카테고리만 응답
  r = await fetch(`${BASE}/api/external/products?category=water&limit=3`, { headers: { Authorization: `Bearer ${waterKey}` } });
  if (r.ok) {
    const j = await r.json();
    const allWater = j.products.every((p: { category: string }) => p.category === "water");
    if (allWater && j.products.length > 0) ok(`카테고리 필터 — water-only`, `${j.products.length}건 모두 water`);
    else ko("카테고리 필터", `mixed: ${j.products.map((p: { category: string }) => p.category).join(",")}`);
  } else { ko("water-only 조회", `status=${r.status}`); }

  // [6] 외부 lead POST
  const phone = `0103${Math.floor(Math.random() * 9000000 + 1000000)}`;
  const customerName = `외부테스트${Math.floor(Math.random() * 9000 + 1000)}`;
  const leadRes = await fetch(`${BASE}/api/external/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${fullKey}` },
    body: JSON.stringify({
      customerName, phone,
      productInterest: "외부 채널 정수기 신청",
      productCode: "WPUJCC104SWH",
      region: "강남",
      selectedMode: "방문형",
      selectedContractPeriod: 60,
    }),
  });
  const leadJson = await leadRes.json();
  const leadId: string | undefined = leadJson.leadId;
  if (leadRes.ok && leadId) {
    ok("외부 lead POST", `id=${leadId} owner=${leadJson.ownerType}`);
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead?.source === "api_partner" && lead.externalChannel === "demo-mall") ok("lead.source=api_partner + externalChannel=demo-mall");
    else ko("lead source 기록", `source=${lead?.source} channel=${lead?.externalChannel}`);
    if (lead?.ownerType === "hq_pool") ok("외부 lead → hq_pool 분류");
    else ko("ownerType", `${lead?.ownerType}`);

    // 정리
    await prisma.leadStatusLog.deleteMany({ where: { leadId } });
    await prisma.lead.deleteMany({ where: { id: leadId } });
  } else { ko("외부 lead POST", JSON.stringify(leadJson)); }

  // [7] 본사 직영 사이트 응답
  const directSite = await fetch(`${BASE}/p/hq-direct`);
  if (directSite.ok) ok("본사 직영 사이트 응답 — 200");
  else ko("본사 직영 사이트", `status=${directSite.status}`);

  const total = results.length, okN = results.filter(r => r.ok).length;
  console.log(`\n${"━".repeat(50)}`);
  console.log(`최종: 통과 ${okN} / 실패 ${total - okN}`);
  await prisma.$disconnect();
  if (okN < total) process.exit(1);
}

main().catch(async e => { console.error("\n예외:", e); await prisma.$disconnect(); process.exit(1); });
