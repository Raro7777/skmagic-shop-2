import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 } });
const page = await ctx.newPage();

const naverReqs = [];
page.on("request", req => {
  const u = req.url();
  if (u.includes("wcs.naver")) {
    naverReqs.push(u);
  }
});

await page.goto("https://skmagic-shop.com/p/partner-7714c0/products/WPUIAC606SSB", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);

// trans wrap 먼저
await page.evaluate(() => {
  const w = window;
  const original = w.wcs?.trans;
  if (!w.wcs || !original) return;
  w.__transCalls = [];
  w.wcs.trans = function(conv) {
    w.__transCalls.push(conv);
    return original.call(this, conv);
  };
});

// 신청 버튼 클릭 (정확한 텍스트)
console.log("=== 1) ✍ 상담 신청하기 → 버튼 클릭 (모달 열기 = custom003 기대) ===");
await page.locator('button:has-text("상담 신청하기")').first().click().catch(e => console.log("  ", e.message.slice(0, 50)));
await page.waitForTimeout(1500);
let calls = await page.evaluate(() => window.__transCalls);
console.log(`  trans 누적: ${JSON.stringify(calls)}`);
const modalOpen = await page.locator('text=상담 신청').nth(1).isVisible().catch(() => false);
console.log(`  모달 열림: ${modalOpen}`);

if (modalOpen) {
  console.log("\n=== 2) 모달 안에서 폼 작성 + 제출 (lead 기대) ===");
  // 이름 input (모달 안의 text input 중 첫 번째)
  const nameInputs = page.locator('input[placeholder*="홍길동"], input[placeholder*="이름"]');
  await nameInputs.first().fill("테스트").catch(() => {});
  // 휴대폰 input
  await page.locator('input[inputMode="tel"]').first().fill("01099998888").catch(() => {});
  // 지역
  const regionIn = page.locator('input[placeholder*="강남구"], input[placeholder*="지역"]');
  await regionIn.first().fill("서울 테스트").catch(() => {});
  // 신청하기 버튼
  await page.locator('button:has-text("신청하기")').last().click().catch(() => {});
  await page.waitForTimeout(3000);
  calls = await page.evaluate(() => window.__transCalls);
  console.log(`  trans 누적: ${JSON.stringify(calls)}`);
}

console.log(`\n📊 최종 네이버 네트워크 요청: ${naverReqs.length}건`);
for (const r of naverReqs) console.log(`  ← ${r.slice(0, 80)}`);

await browser.close();
