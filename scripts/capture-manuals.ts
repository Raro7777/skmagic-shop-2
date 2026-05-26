/**
 * 매뉴얼용 페이지 캡처 자동화.
 *
 * Usage:
 *   MANUAL_TARGET=super|franchise|seller|all \
 *   MANUAL_EMAIL=<로그인 이메일> MANUAL_PASSWORD=<비번> \
 *   MANUAL_BASE_URL=https://skmagic-shop.com \
 *   npx tsx scripts/capture-manuals.ts
 *
 * 결과: ./manuals/<target>/<NN-slug>.png + ./manuals/<target>/index.json
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

type Target = "super" | "franchise" | "seller";

const TARGETS: Record<Target, Array<{ slug: string; title: string; path: string; wait?: number }>> = {
  super: [
    { slug: "00-dashboard",       title: "본사 대시보드",          path: "/admin/super" },
    { slug: "01-enrollments",     title: "전체 신청서",            path: "/admin/super/enrollments" },
    { slug: "02-verify",          title: "인증 처리",              path: "/admin/super/verify" },
    { slug: "03-installs",        title: "설치 완료 처리",         path: "/admin/super/installs" },
    { slug: "04-partners",        title: "협력점 관리",            path: "/admin/super/partners" },
    { slug: "05-users",           title: "사용자 관리",            path: "/admin/super/users" },
    { slug: "06-audit-log",       title: "감사 로그",              path: "/admin/super/audit-log" },
    { slug: "07-approvals",       title: "승인 대기열",            path: "/admin/super/approvals" },
    { slug: "08-duplicates",      title: "중복 DB 판정",           path: "/admin/super/duplicates" },
    { slug: "09-reviews",         title: "후기 승인",              path: "/admin/super/reviews" },
    { slug: "10-anomalies",       title: "운영 이상감지",          path: "/admin/super/anomalies" },
    { slug: "11-analytics",       title: "마케팅 분석",            path: "/admin/super/analytics" },
    { slug: "12-apply-share",     title: "분양신청 링크 공유",      path: "/admin/super/apply-share" },
    { slug: "13-products",        title: "상품 마스터",            path: "/admin/super/products" },
    { slug: "14-policies",        title: "기준 정책",              path: "/admin/super/policies" },
    { slug: "15-banner-templates",title: "배너 템플릿",            path: "/admin/super/banner-templates" },
    { slug: "16-global-banners",  title: "본사 공통 배너",         path: "/admin/super/global-banners" },
    { slug: "17-broadcasts",      title: "본사 공지",              path: "/admin/super/broadcasts" },
    { slug: "18-crawl",           title: "상품 크롤링",            path: "/admin/super/crawl" },
    { slug: "19-crawl-queue",     title: "크롤 검토 큐",           path: "/admin/super/crawl/queue" },
    { slug: "20-api-partners",    title: "외부 API 채널",          path: "/admin/super/api-partners" },
    { slug: "21-hq-settings",     title: "SK매직 가입조건",        path: "/admin/super/hq-settings" },
    { slug: "22-hq-template",     title: "본사 표준 메인페이지",    path: "/admin/super/hq-template" },
    { slug: "23-settlements",     title: "정산 / 수수료",          path: "/admin/super/settlements" },
    { slug: "24-refunds",         title: "환수 관리",              path: "/admin/super/refunds" },
  ],
  franchise: [
    { slug: "00-dashboard",       title: "운영 대시보드",          path: "/admin/franchise" },
    { slug: "01-leads",           title: "상담 / 문의",            path: "/admin/franchise/leads" },
    { slug: "02-enrollments",     title: "가입 신청서",            path: "/admin/franchise/enrollments" },
    { slug: "03-sellers",         title: "영업자 · 링크",          path: "/admin/franchise/sellers" },
    { slug: "04-products",        title: "상품 진열 · 정책",        path: "/admin/franchise/products" },
    { slug: "05-design",          title: "사이트 디자인 · 배너",   path: "/admin/franchise/design" },
    { slug: "06-settings",        title: "사이트 설정",            path: "/admin/franchise/settings" },
    { slug: "07-settlements",     title: "정산",                   path: "/admin/franchise/settlements" },
    { slug: "08-marketing",       title: "마케팅 분석",            path: "/admin/franchise/marketing" },
    { slug: "09-reviews",         title: "설치 후기",              path: "/admin/franchise/reviews" },
  ],
  seller: [
    { slug: "00-dashboard",       title: "내 대시보드",            path: "/admin/seller" },
    { slug: "01-leads",           title: "내 lead",                path: "/admin/seller/leads" },
    { slug: "02-enrollments",     title: "내 신청서",              path: "/admin/seller/enrollments" },
    { slug: "03-links",           title: "공유 링크",              path: "/admin/seller/links" },
    { slug: "04-footer",          title: "내 푸터 정보",           path: "/admin/seller/footer" },
  ],
};

async function login(page: Page, baseUrl: string, email: string, password: string) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  // NextAuth credentials 폼 — email/password input
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
}

async function captureTarget(target: Target, baseUrl: string, email: string, password: string) {
  const outDir = path.resolve(`./manuals/${target}`);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "ko-KR",
  });
  const page = await ctx.newPage();

  console.log(`▶ ${target} 로그인 중…`);
  await login(page, baseUrl, email, password);
  console.log(`  ✓ ${page.url()}`);

  const items = TARGETS[target];
  const captured: Array<{ slug: string; title: string; path: string; url: string }> = [];

  for (const item of items) {
    const url = `${baseUrl}${item.path}`;
    console.log(`▶ [${item.slug}] ${item.title} — ${url}`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      if (item.wait) await page.waitForTimeout(item.wait);
      // 추가 안정화 — body height 안정
      await page.waitForTimeout(800);
      const file = path.join(outDir, `${item.slug}.png`);
      await page.screenshot({ path: file, fullPage: true });
      captured.push({ slug: item.slug, title: item.title, path: item.path, url });
      console.log(`  ✓ ${file}`);
    } catch (e) {
      console.warn(`  ⚠ 실패: ${e instanceof Error ? e.message : e}`);
    }
  }

  await writeFile(path.join(outDir, "index.json"), JSON.stringify(captured, null, 2));
  console.log(`\n✅ ${target} ${captured.length}/${items.length} 캡처 완료 → ${outDir}`);

  await browser.close();
}

async function main() {
  const baseUrl = process.env.MANUAL_BASE_URL ?? "https://skmagic-shop.com";
  const email = process.env.MANUAL_EMAIL;
  const password = process.env.MANUAL_PASSWORD;
  if (!email || !password) {
    console.error("MANUAL_EMAIL / MANUAL_PASSWORD 환경변수 필요");
    process.exit(1);
  }
  const targetArg = (process.env.MANUAL_TARGET ?? "all") as Target | "all";
  const targets: Target[] = targetArg === "all" ? ["super", "franchise", "seller"] : [targetArg];
  for (const t of targets) {
    await captureTarget(t, baseUrl, email, password);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
