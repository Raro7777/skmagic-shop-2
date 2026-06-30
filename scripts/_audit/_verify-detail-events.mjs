import { chromium } from "playwright";

// 상품 상세 페이지 sticky CTA — 네이버 봇이 검수한 페이지
const URL = "https://skmagic-shop.com/p/partner-7714c0/products/WPUIAC506SNS";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 } });
const page = await ctx.newPage();

const naverReqs = [];
page.on("request", req => {
  const u = req.url();
  if (u.includes("wcs.naver")) {
    naverReqs.push({ url: u, time: Date.now() });
    console.log(`  ← ${req.method()} ${u.slice(0, 120)}`);
  }
});
page.on("console", msg => {
  const t = msg.text();
  if (t.includes("[wrap]") || t.includes("[trans]")) console.log(`  [browser] ${t}`);
});

console.log(`→ 페이지 진입: ${URL}`);
await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);

await page.evaluate(() => {
  const w = window;
  w.__calls = [];
  const origTrans = w.wcs?.trans;
  if (origTrans) {
    w.wcs.trans = function(conv) {
      w.__calls.push({ kind: "trans", type: conv?.type });
      console.log(`[wrap] trans(${conv?.type})`);
      try { return origTrans.call(this, conv); } catch {}
    };
  }
});

const fnState = await page.evaluate(() => ({
  NA_CONV_LEAD: typeof window.NA_CONV_LEAD,
  NA_CONV_CUSTOM001: typeof window.NA_CONV_CUSTOM001,
  NA_CONV_CUSTOM002: typeof window.NA_CONV_CUSTOM002,
  NA_CONV_CUSTOM003: typeof window.NA_CONV_CUSTOM003,
  wcs_trans: typeof window.wcs?.trans,
}));
console.log("\n=== 글로벌 함수 / wcs API 상태 ===");
console.log(JSON.stringify(fnState, null, 2));

// sticky bottom 의 onmousedown 가진 모든 a/button 노출
const ctaLocators = await page.evaluate(() => {
  const list = [];
  document.querySelectorAll("[onmousedown]").forEach(el => {
    const md = el.getAttribute("onmousedown");
    if (md && md.includes("NA_CONV")) {
      const cls = el.className || "";
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || "").trim().slice(0, 30);
      list.push({ tag, md: md.replace(/javascript:try\{|\(\);}catch\(e\)\{\}/g, ""), text, cls: cls.slice(0, 80) });
    }
  });
  return list;
});
console.log("\n=== 페이지에 노출된 onmousedown NA_CONV 요소 ===");
for (const c of ctaLocators) console.log(`  ${c.tag} [${c.md}] "${c.text}" (${c.cls})`);

// 1) 전화 mousedown
console.log("\n=== [1] 전화 a 태그 mousedown (custom001) ===");
const telLocator = page.locator('a[href^="tel:"][onmousedown*="NA_CONV_CUSTOM001"]').first();
const telCount = await telLocator.count();
console.log(`  찾은 전화 a 태그: ${telCount}개`);
if (telCount > 0) {
  await telLocator.dispatchEvent("mousedown");
  await page.waitForTimeout(1500);
}

// 2) 카톡 mousedown
console.log("\n=== [2] 카톡 a 태그 mousedown (custom002) ===");
const kakaoLocator = page.locator('a[href*="kakao"][onmousedown*="NA_CONV_CUSTOM002"]').first();
const kakaoCount = await kakaoLocator.count();
console.log(`  찾은 카톡 a 태그: ${kakaoCount}개`);
if (kakaoCount > 0) {
  await kakaoLocator.dispatchEvent("mousedown");
  await page.waitForTimeout(1500);
}

// 3) 상담신청 button mousedown
console.log("\n=== [3] 상담신청 button mousedown (custom003) ===");
const consultLocator = page.locator('button[onmousedown*="NA_CONV_CUSTOM003"]').first();
const consultCount = await consultLocator.count();
console.log(`  찾은 상담신청 button: ${consultCount}개`);
if (consultCount > 0) {
  await consultLocator.dispatchEvent("mousedown");
  await page.waitForTimeout(1500);
}

// 4) NA_CONV_LEAD 직접 호출 (폼 success 시뮬)
console.log("\n=== [4] NA_CONV_LEAD 직접 호출 (lead) ===");
await page.evaluate(() => {
  if (typeof window.NA_CONV_LEAD === "function") window.NA_CONV_LEAD();
});
await page.waitForTimeout(1500);

const calls = await page.evaluate(() => window.__calls);
const types = new Set(calls.filter(c => c.kind === "trans").map(c => c.type));
console.log(`\n=== 📊 wrap 으로 잡힌 호출 (${calls.length}건) ===`);
for (const c of calls) console.log(`  ${c.kind}/${c.type}`);

console.log(`\n=== 🌐 wcs.naver 네트워크 요청 (${naverReqs.length}건) ===`);
for (const r of naverReqs) console.log(`  ${r.url.slice(0, 100)}`);

console.log("\n=== ✅ 종합 ===");
console.log(`  trans(custom001) : ${types.has("custom001") ? "✅" : "❌"}`);
console.log(`  trans(custom002) : ${types.has("custom002") ? "✅" : "❌"}`);
console.log(`  trans(custom003) : ${types.has("custom003") ? "✅" : "❌"}`);
console.log(`  trans(lead)      : ${types.has("lead") ? "✅" : "❌"}`);

await browser.close();
