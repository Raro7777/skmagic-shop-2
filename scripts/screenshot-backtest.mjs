import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = "http://localhost:3100";
const partners = [
  "partner-03b31b",
  "partner-4d7063",
  "partner-823035",
  "partner-1a2af0",
  "partner-d29bcd",
  "partner-7714c0",
];

mkdirSync("/tmp/banner-test", { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

for (const c of partners) {
  const url = `${base}/p/${c}`;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) {
    console.log(`WARN ${c} networkidle timeout, falling back`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  }
  await page.waitForTimeout(1200);
  const out = `/tmp/banner-test/${c}.png`;
  await page.screenshot({ path: out, fullPage: true });
  console.log(`OK  ${c} -> ${out}`);
}
await browser.close();
