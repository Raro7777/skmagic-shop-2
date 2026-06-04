import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 } });
const page = await ctx.newPage();

// wcs 관련 모든 요청 캡처
const naverReqs = [];
page.on("request", req => {
  const u = req.url();
  if (u.includes("wcs.naver") || u.includes("naver.com/wcs")) {
    naverReqs.push({ url: u, time: Date.now() });
  }
});

// page console 도 캡처
page.on("console", msg => {
  if (msg.text().includes("[trans]")) console.log(`  [browser] ${msg.text()}`);
});

console.log("→ https://skmagic-shop.com/p/partner-7714c0/products/WPUIAC606SSB");
await page.goto("https://skmagic-shop.com/p/partner-7714c0/products/WPUIAC606SSB", {
  waitUntil: "networkidle", timeout: 30000,
});
await page.waitForTimeout(1500);

// wcs.trans 를 wrap 해서 호출 추적
const transCalls = await page.evaluate(() => {
  return new Promise(resolve => {
    const calls = [];
    const w = window;
    if (!w.wcs?.trans) { resolve({ ok: false, reason: "wcs.trans 함수 없음" }); return; }
    const original = w.wcs.trans;
    w.wcs.trans = function(conv) {
      calls.push(conv);
      console.log(`[trans] type=${conv?.type}`);
      try { return original.call(this, conv); } catch { /* noop */ }
    };
    w.__transCalls = calls;
    resolve({ ok: true, ready: true });
  });
});
console.log(`\nwcs.trans wrap 결과:`, transCalls);

// 1. 상담신청 버튼 클릭 (custom003) — 페이지 하단 sticky CTA 의 "상담신청" 버튼
console.log("\n[1] 신청 버튼 클릭 시뮬레이션 (custom003 기대)");
await page.locator('button:has-text("상담신청")').first().click().catch(() => {});
await page.waitForTimeout(800);
const after1 = await page.evaluate(() => window.__transCalls);
console.log(`  trans 호출: ${JSON.stringify(after1)}`);

// 2. 모달 안에서 폼 작성 후 제출 (lead 기대)
console.log("\n[2] 모달에서 폼 제출 시뮬레이션 (lead 기대)");
await page.locator('input[placeholder*="홍길동"]').first().fill("테스트사용자");
await page.locator('input[placeholder*="010"]').first().fill("01099998888");
await page.locator('input[placeholder*="강남구"]').first().fill("서울 테스트구");
await page.locator('button:has-text("신청하기")').first().click();
await page.waitForTimeout(2000);
const after2 = await page.evaluate(() => window.__transCalls);
console.log(`  누적 trans 호출: ${JSON.stringify(after2)}`);

console.log(`\n=== 네이버 네트워크 요청 ${naverReqs.length}건 ===`);
for (const r of naverReqs) console.log(`  → ${r.url.slice(0, 100)}`);

await browser.close();
console.log("\n검증 완료");
