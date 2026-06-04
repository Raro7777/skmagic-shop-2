import { chromium } from "playwright";

const TARGETS = [
  { code: "WPUIAC606SSB", label: "MEGA ICE mini 애쉬블루" },
  { code: "WPUIAC606SNW", label: "MEGA ICE mini 내츄럴화이트" },
  { code: "ACL16C2ASKZG", label: "디아트 16평 다크그린" },
  { code: "MATQM230RSBR", label: "워커힐 스위트 Q" },
];
const BASE = "https://skmagic-shop.com/p/partner-7714c0/products";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 } });

for (const { code, label } of TARGETS) {
  console.log(`\n============ ${label} (${code}) ============`);
  const page = await ctx.newPage();
  const url = `${BASE}/${code}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

  // 모드 토글 (방문형/셀프형)
  const modeBtns = await page.locator('button:has-text("방문형"), button:has-text("셀프형")').allTextContents();
  const uniqueModes = [...new Set(modeBtns.map(s => s.trim()))];
  console.log(`  운영 방식 옵션: ${uniqueModes.join(", ")}`);

  // 의무사용기간 버튼들
  const periodTexts = await page.locator('button:has-text("개월")').allTextContents();
  const periods = periodTexts.map(s => s.trim()).filter(s => /^\d+개월$/.test(s));
  const uniq = [...new Set(periods)];
  console.log(`  의무사용기간 노출: [${periods.join(", ")}] (총 ${periods.length}개)`);
  console.log(`  고유: [${uniq.join(", ")}] (${uniq.length}개)`);
  const dupCheck = periods.length === uniq.length ? "✅ 중복 없음" : `❌ 중복 ${periods.length - uniq.length}건`;
  console.log(`  ${dupCheck}`);

  // 기본 선택 옵션 (active 버튼)
  const activeBtns = await page.locator('button[class*="bg-rk-navy"], button[class*="text-white"]').allTextContents();
  const selected = activeBtns.filter(t => /개월|방문형|셀프형/.test(t)).map(s => s.trim());
  console.log(`  기본 선택: ${selected.join(" / ")}`);

  // 최종 월 요금
  const finalPrice = await page.locator('text=/최종 월 요금/').first().locator('..').textContent().catch(() => null);
  console.log(`  최종 월 요금 영역: ${(finalPrice ?? "").slice(0, 100).replace(/\s+/g, " ")}`);

  // 방문형/셀프형 토글 후 가격 변경 검사
  if (uniqueModes.includes("셀프형")) {
    try {
      await page.locator('button:has-text("셀프형")').first().click();
      await page.waitForTimeout(500);
      const afterToggle = await page.locator('text=/최종 월 요금/').first().locator('..').textContent().catch(() => null);
      const beforeSlice = (finalPrice ?? "").slice(0, 60);
      const afterSlice = (afterToggle ?? "").slice(0, 60);
      const changed = beforeSlice !== afterSlice;
      console.log(`  방문→셀프 전환 후 가격 변경: ${changed ? "✅" : "⚠ 동일"}`);
    } catch (e) {
      console.log(`  방문→셀프 토글 실패: ${e.message}`);
    }
  }

  // 스크린샷
  await page.screenshot({ path: `/tmp/banner-test/verify-${code}.png`, fullPage: true });
  await page.close();
}

await browser.close();
console.log("\n✓ 스크린샷 저장: /tmp/banner-test/verify-*.png");
