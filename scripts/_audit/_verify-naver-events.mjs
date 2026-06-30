import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 } });
const page = await ctx.newPage();

const naverReqs = [];
page.on("request", req => {
  const u = req.url();
  if (u.includes("wcs.naver")) {
    naverReqs.push({ url: u, time: Date.now() });
    console.log(`  ← ${req.method()} ${u.slice(0, 100)}`);
  }
});
page.on("console", msg => {
  const t = msg.text();
  if (t.includes("[wrap]") || t.includes("[trans]")) console.log(`  [browser] ${t}`);
});

const URL = "https://skmagic-shop.com/p/partner-7714c0/products";
console.log(`→ 페이지 진입: ${URL}`);
await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);

// wcs.trans + wcs.inflow + wcs_do wrap
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
  const origInflow = w.wcs?.inflow;
  if (origInflow) {
    w.wcs.inflow = function(...args) {
      w.__calls.push({ kind: "inflow", args });
      console.log(`[wrap] inflow(${JSON.stringify(args)})`);
      try { return origInflow.apply(this, args); } catch {}
    };
  }
  const origDo = w.wcs_do;
  if (origDo) {
    w.wcs_do = function() {
      w.__calls.push({ kind: "wcs_do" });
      console.log(`[wrap] wcs_do()`);
      try { return origDo.call(this); } catch {}
    };
  }
});

// 글로벌 함수 존재 확인
const fnState = await page.evaluate(() => ({
  NA_CONV_LEAD: typeof window.NA_CONV_LEAD,
  NA_CONV_CUSTOM001: typeof window.NA_CONV_CUSTOM001,
  NA_CONV_CUSTOM002: typeof window.NA_CONV_CUSTOM002,
  NA_CONV_CUSTOM003: typeof window.NA_CONV_CUSTOM003,
  wcs_trans: typeof window.wcs?.trans,
  wcs_inflow: typeof window.wcs?.inflow,
  wcs_do: typeof window.wcs_do,
}));
console.log("\n=== 글로벌 함수 / wcs API 상태 ===");
console.log(JSON.stringify(fnState, null, 2));

// 1) 전화상담 mousedown
console.log("\n=== [1] 전화상담 버튼 mousedown ===");
const telLocator = page.locator('a[href^="tel:"][onmousedown*="NA_CONV_CUSTOM001"]').first();
const telCount = await telLocator.count();
console.log(`  찾은 전화상담 a 태그: ${telCount}개`);
if (telCount > 0) {
  await telLocator.dispatchEvent("mousedown");
  await page.waitForTimeout(1500);
}

// 2) 카톡상담 mousedown
console.log("\n=== [2] 카톡상담 버튼 mousedown ===");
const kakaoLocator = page.locator('a[href*="kakao"][onmousedown*="NA_CONV_CUSTOM002"]').first();
const kakaoCount = await kakaoLocator.count();
console.log(`  찾은 카톡상담 a 태그: ${kakaoCount}개`);
if (kakaoCount > 0) {
  await kakaoLocator.dispatchEvent("mousedown");
  await page.waitForTimeout(1500);
}

// 3) 상담신청 버튼 mousedown
console.log("\n=== [3] 상담신청 버튼 mousedown ===");
const consultLocator = page.locator('button[onmousedown*="NA_CONV_CUSTOM003"]').first();
const consultCount = await consultLocator.count();
console.log(`  찾은 상담신청 button: ${consultCount}개`);
if (consultCount > 0) {
  await consultLocator.dispatchEvent("mousedown");
  await page.waitForTimeout(1500);
}

// 4) 상담 폼 제출 시뮬레이션 → lead (현재는 직접 NA_CONV_LEAD 호출만)
console.log("\n=== [4] NA_CONV_LEAD 직접 호출 (폼 success 시점 시뮬) ===");
await page.evaluate(() => {
  if (typeof window.NA_CONV_LEAD === "function") {
    window.NA_CONV_LEAD();
  }
});
await page.waitForTimeout(1500);

// 결과
const calls = await page.evaluate(() => window.__calls);
console.log(`\n=== 📊 wrap 으로 잡힌 호출 (총 ${calls.length}건) ===`);
for (const c of calls) console.log(`  ${c.kind}${c.type ? "/" + c.type : ""}${c.args ? "(" + JSON.stringify(c.args) + ")" : ""}`);

console.log(`\n=== 🌐 wcs.naver 네트워크 요청 (총 ${naverReqs.length}건) ===`);
for (const r of naverReqs) console.log(`  ${r.url.slice(0, 100)}`);

// 통과 판정
const types = new Set(calls.filter(c => c.kind === "trans").map(c => c.type));
const hasInflow = calls.some(c => c.kind === "inflow");
const hasWcsDo = calls.some(c => c.kind === "wcs_do");
console.log("\n=== ✅ 종합 ===");
console.log(`  inflow 호출         : ${hasInflow ? "❌ wrap 후라 시점 놓침 (정상)" : "(wrap 시점에 inflow 이미 끝남)"}`);
console.log(`  wcs_do 호출         : ${hasWcsDo ? "❌ 시점 놓침" : "(wrap 시점에 wcs_do 이미 끝남)"}`);
console.log(`  trans(lead)         : ${types.has("lead") ? "✅" : "❌"}`);
console.log(`  trans(custom001)    : ${types.has("custom001") ? "✅" : "❌"}`);
console.log(`  trans(custom002)    : ${types.has("custom002") ? "✅" : "❌"}`);
console.log(`  trans(custom003)    : ${types.has("custom003") ? "✅" : "❌"}`);

await browser.close();
