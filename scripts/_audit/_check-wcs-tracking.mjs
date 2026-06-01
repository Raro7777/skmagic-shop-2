import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const naverRequests = [];
page.on("request", req => {
  const u = req.url();
  if (u.includes("wcs.naver") || u.includes("naver.com/wcs")) naverRequests.push({ url: u, method: req.method() });
});
page.on("response", res => {
  const u = res.url();
  if (u.includes("wcs.naver") || u.includes("naver.com/wcs")) console.log(`  ← ${res.status()} ${u.slice(0, 100)}`);
});

console.log("→ https://skmagic-shop.com/p/partner-7714c0 진입");
await page.goto("https://skmagic-shop.com/p/partner-7714c0", { waitUntil: "networkidle", timeout: 30000 });

const wcsState = await page.evaluate(() => ({
  wcs_add: window.wcs_add ?? null,
  wcs_loaded: typeof window.wcs !== "undefined",
  inflow_function: typeof window.wcs?.inflow === "function",
  wcs_do_function: typeof window.wcs_do === "function",
}));

console.log(`\n=== 네이버 wcs 요청 수: ${naverRequests.length} ===`);
for (const r of naverRequests.slice(0, 10)) console.log(`  → ${r.method} ${r.url.slice(0, 120)}`);

console.log("\n=== window 상태 ===");
console.log(JSON.stringify(wcsState, null, 2));

await browser.close();
