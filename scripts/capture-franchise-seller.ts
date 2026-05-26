/**
 * 본사 슈퍼관리자로 로그인 → 협력점/영업자 콘솔에 임시진입(impersonation) 후 캡처.
 *   - franchise: hq_view_partner 쿠키 세팅 → /admin/franchise/*
 *   - seller   : console_view_seller 쿠키 세팅 → /admin/seller/*
 *
 * Usage:
 *   MANUAL_EMAIL=... MANUAL_PASSWORD=... npx tsx scripts/capture-franchise-seller.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { chromium, type Page, type BrowserContext } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const FRANCHISE_PAGES = [
  { slug: "00-dashboard",   title: "운영 대시보드",     path: "/admin/franchise" },
  { slug: "01-leads",       title: "상담 / 문의",       path: "/admin/franchise/leads" },
  { slug: "02-enrollments", title: "가입 신청서",       path: "/admin/franchise/enrollments" },
  { slug: "03-sellers",     title: "영업자 · 링크",     path: "/admin/franchise/sellers" },
  { slug: "04-products",    title: "상품 진열 · 정책",  path: "/admin/franchise/products" },
  { slug: "05-design",      title: "사이트 디자인",     path: "/admin/franchise/design" },
  { slug: "06-settings",    title: "사이트 설정",       path: "/admin/franchise/settings" },
  { slug: "07-settlements", title: "정산",              path: "/admin/franchise/settlements" },
  { slug: "08-marketing",   title: "마케팅 분석",       path: "/admin/franchise/marketing" },
  { slug: "09-reviews",     title: "설치 후기",         path: "/admin/franchise/reviews" },
];

const SELLER_PAGES = [
  { slug: "00-dashboard",   title: "내 대시보드",  path: "/admin/seller" },
  { slug: "01-leads",       title: "내 lead",      path: "/admin/seller/leads" },
  { slug: "02-enrollments", title: "내 신청서",    path: "/admin/seller/enrollments" },
  { slug: "03-links",       title: "공유 링크",    path: "/admin/seller/links" },
  { slug: "04-footer",      title: "내 푸터 정보", path: "/admin/seller/footer" },
];

async function login(page: Page, baseUrl: string, email: string, password: string) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
}

async function capturePages(
  page: Page,
  baseUrl: string,
  outDir: string,
  items: typeof FRANCHISE_PAGES,
) {
  await mkdir(outDir, { recursive: true });
  const captured: Array<{ slug: string; title: string; path: string }> = [];
  for (const item of items) {
    const url = `${baseUrl}${item.path}`;
    console.log(`▶ [${item.slug}] ${item.title} — ${url}`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(800);
      const file = path.join(outDir, `${item.slug}.png`);
      await page.screenshot({ path: file, fullPage: true });
      captured.push({ slug: item.slug, title: item.title, path: item.path });
      console.log(`  ✓ ${file}`);
    } catch (e) {
      console.warn(`  ⚠ 실패: ${e instanceof Error ? e.message : e}`);
    }
  }
  await writeFile(path.join(outDir, "index.json"), JSON.stringify(captured, null, 2));
  return captured.length;
}

/** 본사 슈퍼관리자가 협력점/영업자 콘솔에 진입할 때 사용하는 API. */
async function impersonatePartner(ctx: BrowserContext, baseUrl: string, partnerCode: string) {
  // hq-view-partner POST → 쿠키 세팅
  const page = await ctx.newPage();
  const res = await page.request.post(`${baseUrl}/api/admin/hq-view-partner`, {
    data: { partnerCode },
  });
  if (!res.ok()) throw new Error(`impersonate partner 실패: ${res.status()} ${await res.text()}`);
  await page.close();
}
async function impersonateSeller(ctx: BrowserContext, baseUrl: string, sellerId: string) {
  const page = await ctx.newPage();
  const res = await page.request.post(`${baseUrl}/api/console/enter-seller`, {
    data: { sellerId },
  });
  if (!res.ok()) throw new Error(`impersonate seller 실패: ${res.status()} ${await res.text()}`);
  await page.close();
}

async function main() {
  const baseUrl = process.env.MANUAL_BASE_URL ?? "https://skmagic-shop.com";
  const email = process.env.MANUAL_EMAIL;
  const password = process.env.MANUAL_PASSWORD;
  if (!email || !password) {
    console.error("MANUAL_EMAIL / MANUAL_PASSWORD 필요");
    process.exit(1);
  }
  const targetPartner = process.env.MANUAL_PARTNER ?? "partner-1a2af0"; // 우주 안드로메다점 (예시)
  const targetSellerId = process.env.MANUAL_SELLER_ID; // optional — 비우면 partner 의 첫 active seller 자동 선택

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "ko-KR",
  });
  const page = await ctx.newPage();

  console.log("▶ 본사 슈퍼관리자 로그인…");
  await login(page, baseUrl, email, password);
  console.log(`  ✓ ${page.url()}`);

  // franchise — partner 임시진입
  console.log(`\n▶ partner-${targetPartner} 임시진입`);
  await impersonatePartner(ctx, baseUrl, targetPartner);
  const fCount = await capturePages(
    page, baseUrl,
    path.resolve("./manuals/franchise"),
    FRANCHISE_PAGES,
  );
  console.log(`\n✅ franchise ${fCount}/${FRANCHISE_PAGES.length}`);

  // seller — 영업자 ID 찾기 (스크립트 인자 없으면 partner 첫 영업자)
  let sellerId = targetSellerId;
  if (!sellerId) {
    // 본사 컨텍스트 sellers API 활용 — partner 임시진입 상태에서 본인 점 영업자 목록 조회
    const apiPage = await ctx.newPage();
    await apiPage.goto(`${baseUrl}/api/sellers`);
    const body = await apiPage.evaluate(() => document.body.innerText);
    try {
      const parsed = JSON.parse(body) as { sellers?: Array<{ id: string; status: string }> };
      const active = parsed.sellers?.find(s => s.status === "active");
      sellerId = active?.id;
    } catch { /* noop */ }
    await apiPage.close();
  }
  if (!sellerId) {
    console.warn("⚠ active seller 못 찾음 — seller 캡처 스킵. MANUAL_SELLER_ID 환경변수로 직접 지정 가능.");
  } else {
    console.log(`\n▶ seller ${sellerId} 임시진입`);
    await impersonateSeller(ctx, baseUrl, sellerId);
    const sCount = await capturePages(
      page, baseUrl,
      path.resolve("./manuals/seller"),
      SELLER_PAGES,
    );
    console.log(`\n✅ seller ${sCount}/${SELLER_PAGES.length}`);
  }

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
