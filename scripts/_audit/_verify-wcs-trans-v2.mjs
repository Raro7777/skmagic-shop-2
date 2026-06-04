import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 } });
const page = await ctx.newPage();

const naverReqs = [];
page.on("request", req => {
  const u = req.url();
  if (u.includes("wcs.naver") || u.includes("naver.com/wcs") || u.includes("siat.naver")) {
    naverReqs.push({ url: u });
    console.log(`  ← request ${u.slice(0, 100)}`);
  }
});
page.on("console", msg => {
  if (msg.text().includes("[wrap]")) console.log(`  [browser] ${msg.text()}`);
});

console.log("→ 페이지 진입");
await page.goto("https://skmagic-shop.com/p/partner-7714c0/products/WPUIAC606SSB", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);

// wcs.trans wrap
await page.evaluate(() => {
  const w = window;
  if (!w.wcs) return;
  if (!w.wcs.trans) {
    w.wcs.trans = function(conv) { console.log(`[wrap] trans(${conv?.type}) - was stub`); window.__transCalls = (window.__transCalls ?? []).concat([conv]); };
  } else {
    const original = w.wcs.trans;
    w.wcs.trans = function(conv) { console.log(`[wrap] trans(${conv?.type})`); window.__transCalls = (window.__transCalls ?? []).concat([conv]); return original.call(this, conv); };
  }
});

console.log("\n=== [A] 수동 wcs.trans 직접 호출 테스트 ===");
await page.evaluate(() => {
  window.wcs?.trans?.({ type: "lead" });
  window.wcs?.trans?.({ type: "custom001" });
});
await page.waitForTimeout(1000);

console.log("\n=== [B] 페이지의 모든 버튼 텍스트 dump ===");
const btnTexts = await page.locator('button').allTextContents();
const cleaned = btnTexts.map(s => s.trim()).filter(s => s.length > 0 && s.length < 30);
console.log(`  버튼 수: ${cleaned.length}`);
const consultBtns = cleaned.filter(t => t.includes("상담") || t.includes("신청"));
console.log(`  상담/신청 관련: ${consultBtns.join(" | ")}`);

console.log("\n=== [C] 신청 버튼 클릭 (sticky CTA 의 ✍ 상담신청) ===");
// sticky 영역에 있는 ✍ 상담신청 버튼
try {
  await page.locator('button:has-text("✍ 상담신청")').first().click({ timeout: 5000 });
  console.log("  ✓ 클릭 성공");
} catch (e) {
  console.log(`  ✗ 클릭 실패: ${e.message.slice(0, 60)}`);
}
await page.waitForTimeout(1000);

const callsAfterClick = await page.evaluate(() => window.__transCalls);
console.log(`  trans 호출 누적: ${JSON.stringify(callsAfterClick)}`);

// 모달 열렸는지 확인
const modalVisible = await page.locator('text=상담 신청').nth(1).isVisible().catch(() => false);
console.log(`  모달 노출: ${modalVisible}`);

if (modalVisible) {
  console.log("\n=== [D] 모달 폼 제출 (lead 기대) ===");
  // 입력
  await page.locator('input').nth(0).fill("테스트사용자");
  await page.locator('input[inputMode="tel"]').first().fill("01099998888");
  // 관심상품이 잠긴 상태일 수도 — 입력 가능한 두 번째 input
  const inputs = await page.locator('input').count();
  console.log(`  모달 내 input 수: ${inputs}`);

  await page.locator('button:has-text("신청하기")').first().click().catch(() => {});
  await page.waitForTimeout(3000);
}

const final = await page.evaluate(() => window.__transCalls);
console.log(`\n📊 총 trans 호출: ${JSON.stringify(final)}`);
console.log(`📊 네이버 네트워크 요청: ${naverReqs.length}건`);

await browser.close();
