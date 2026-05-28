import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
for (const code of ['partner-03b31b', 'partner-d29bcd']) {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3100/p/${code}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `/tmp/banner-test/after-${code}.png`, fullPage: true });
  await page.close();
  console.log(`${code} OK`);
}
await browser.close();
