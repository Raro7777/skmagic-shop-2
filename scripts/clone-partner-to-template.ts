/**
 * 인터넷끝판왕(partner-7714c0) → 본사 표준(hq-template) 복제.
 *   - Banner (scope=partner)
 *   - PartnerPolicy (giftLabel/giftAmount/installAmount)
 *   - displayConfig (메인 진열 순서)
 *
 * 안전:
 *   - hq-template 의 기존 Banner / PartnerPolicy 는 먼저 삭제 (clean replace)
 *   - PartnerPolicy 의 sellerMargin override 는 복제 X (협력점 고유값이라)
 *   - Partner 자체 컬럼(theme/rentalSupport/sellerMargin) 은 인터넷끝판왕 기준으로 덮어씀
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SOURCE = "partner-7714c0"; // 인터넷끝판왕
const TARGET = "hq-template";

async function main() {
  const src = await prisma.partner.findUnique({ where: { partnerCode: SOURCE } });
  if (!src) { console.error("source 없음"); process.exit(1); }

  console.log(`▶ 소스: ${src.partnerName} (${SOURCE})`);
  const srcBanners = await prisma.banner.findMany({ where: { partnerId: SOURCE, scope: "partner" } });
  const srcPolicies = await prisma.partnerPolicy.findMany({ where: { partnerId: SOURCE } });
  console.log(`   Banner ${srcBanners.length}개 · PartnerPolicy ${srcPolicies.length}개`);
  console.log(`   theme=${src.theme} 보장=${src.rentalSupportAmount} sellerMargin=${src.sellerMarginAmount}`);

  // hq-template 기존 데이터 삭제 (clean replace)
  console.log(`\n▶ hq-template 기존 데이터 삭제`);
  const delBanners = await prisma.banner.deleteMany({ where: { partnerId: TARGET } });
  const delPolicies = await prisma.partnerPolicy.deleteMany({ where: { partnerId: TARGET } });
  console.log(`   배너 ${delBanners.count}개, 정책 ${delPolicies.count}개 제거`);

  // Partner 컬럼 복제 (푸터·식별 정보는 제외)
  console.log(`\n▶ Partner 컬럼 복제 (theme / 보장 / sellerMargin / displayConfig)`);
  await prisma.partner.update({
    where: { partnerCode: TARGET },
    data: {
      theme: src.theme,
      displayConfig: src.displayConfig ?? undefined,
      rentalSupportAmount: src.rentalSupportAmount,
      rentalSupportEnabled: src.rentalSupportEnabled,
      sellerMarginType: src.sellerMarginType,
      sellerMarginAmount: src.sellerMarginAmount,
      sellerMarginPercent: src.sellerMarginPercent,
    },
  });

  // Banner 복제
  console.log(`\n▶ Banner 복제`);
  let copiedBanners = 0;
  for (const b of srcBanners) {
    await prisma.banner.create({
      data: {
        partnerId: TARGET,
        scope: "partner",
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl,
        bgColor1: b.bgColor1,
        bgColor2: b.bgColor2,
        textColor: b.textColor,
        ctaLabel: b.ctaLabel,
        ctaHref: b.ctaHref,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        priority: b.priority,
        status: b.status,
        layout: b.layout,
        spotlightProductCode: b.spotlightProductCode,
        stampText: b.stampText,
        htmlContent: b.htmlContent,
        sourceTemplateId: b.sourceTemplateId,
      },
    });
    copiedBanners++;
  }
  console.log(`   ${copiedBanners}개 복제`);

  // PartnerPolicy 복제 — sellerMargin override 제외 (협력점 고유값)
  console.log(`\n▶ PartnerPolicy 복제 (사은품·설치비 환원만)`);
  let copiedPolicies = 0;
  for (const pp of srcPolicies) {
    await prisma.partnerPolicy.create({
      data: {
        partnerId: TARGET,
        productId: pp.productId,
        giftLabel: pp.giftLabel,
        giftAmount: pp.giftAmount,
        installAmount: pp.installAmount,
        // sellerMarginAmount/Percent 는 협력점 고유 — 표준에서 제외
      },
    });
    copiedPolicies++;
  }
  console.log(`   ${copiedPolicies}개 복제`);

  console.log(`\n✅ 본사 표준 복제 완료 — Banner ${copiedBanners} · PartnerPolicy ${copiedPolicies}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
