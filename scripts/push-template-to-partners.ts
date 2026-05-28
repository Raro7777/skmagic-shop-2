/**
 * 본사 표준(hq-template) → 기존 active 협력점 일괄 push.
 *
 * 안전 원칙:
 *   - 협력점이 자기 배너를 직접 추가했으면 그대로 보존 (sourceTemplateId 가 'hq-template' 이 아닌 row 는 건드리지 않음)
 *   - 같은 templateId 로 이전에 push 된 배너는 한 번 더 안 만듦 (idempotent)
 *   - PartnerPolicy 는 (partnerId, productId) unique 라 upsert 로 안전
 *   - displayConfig / theme / sellerMargin / 보장은 협력점이 직접 설정한 부분이 많을 수 있어 덮어쓰지 X
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/push-template-to-partners.ts   ← 미리보기
 *   npx tsx scripts/push-template-to-partners.ts             ← 실제 적용
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const TEMPLATE = "hq-template";
const PUSH_MARKER = "hq-template";  // Banner.sourceTemplateId 에 저장하여 다음 push 시 중복 회피

async function main() {
  const dryRun = process.env.DRY_RUN === "1";
  console.log(`▶ 모드: ${dryRun ? "DRY-RUN (미리보기)" : "실제 적용"}\n`);

  // 본사 표준 자료 조회
  const tplBanners = await prisma.banner.findMany({ where: { partnerId: TEMPLATE, scope: "partner" } });
  const tplPolicies = await prisma.partnerPolicy.findMany({ where: { partnerId: TEMPLATE } });
  console.log(`▶ 본사 표준: Banner ${tplBanners.length}개 · PartnerPolicy ${tplPolicies.length}개\n`);
  if (tplBanners.length === 0 && tplPolicies.length === 0) {
    console.log("본사 표준이 비어있음 — push 할 게 없음");
    return;
  }

  // 대상 협력점
  const targets = await prisma.partner.findMany({
    where: { status: "active", partnerCode: { not: TEMPLATE } },
    select: {
      partnerCode: true, partnerName: true,
      banners: { where: { scope: "partner" }, select: { id: true, title: true, sourceTemplateId: true } },
      policies: { select: { id: true, productId: true } },
    },
  });
  console.log(`▶ 대상 협력점 ${targets.length}개\n`);

  let totalAddedBanners = 0;
  let totalAddedPolicies = 0;
  let totalSkippedBanners = 0;
  let totalSkippedPolicies = 0;

  for (const p of targets) {
    const existingTemplateBannerTitles = new Set(
      p.banners.filter(b => b.sourceTemplateId === PUSH_MARKER).map(b => b.title),
    );
    const existingPolicyProductIds = new Set(p.policies.map(pp => pp.productId));

    // 신규 push 할 Banner
    const newBanners = tplBanners.filter(b => !existingTemplateBannerTitles.has(b.title));
    // 협력점 직접 추가한 배너 (sourceTemplateId != marker)
    const ownBanners = p.banners.filter(b => b.sourceTemplateId !== PUSH_MARKER).length;
    // 신규 push 할 Policy (productId 미존재)
    const newPolicies = tplPolicies.filter(pp => !existingPolicyProductIds.has(pp.productId));

    console.log(`  📦 ${p.partnerName} (${p.partnerCode})`);
    console.log(`     기존: 자체 배너 ${ownBanners}개 · 정책 ${p.policies.length}개`);
    console.log(`     추가 예정: 배너 +${newBanners.length} · 정책 +${newPolicies.length}`);
    console.log(`     스킵: 이미 push 된 배너 ${tplBanners.length - newBanners.length}개 · 기존 정책 ${tplPolicies.length - newPolicies.length}개`);

    if (!dryRun) {
      for (const b of newBanners) {
        await prisma.banner.create({
          data: {
            partnerId: p.partnerCode,
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
            sourceTemplateId: PUSH_MARKER, // 다음 push 시 중복 회피
          },
        });
      }
      for (const pp of newPolicies) {
        await prisma.partnerPolicy.create({
          data: {
            partnerId: p.partnerCode,
            productId: pp.productId,
            giftLabel: pp.giftLabel,
            giftAmount: pp.giftAmount,
            installAmount: pp.installAmount,
          },
        });
      }
    }
    totalAddedBanners += newBanners.length;
    totalAddedPolicies += newPolicies.length;
    totalSkippedBanners += tplBanners.length - newBanners.length;
    totalSkippedPolicies += tplPolicies.length - newPolicies.length;
  }

  console.log(`\n${dryRun ? "📋 [DRY-RUN] 예상 결과" : "✅ 실제 적용 완료"}`);
  console.log(`   배너: 추가 ${totalAddedBanners}개 / 스킵 ${totalSkippedBanners}개`);
  console.log(`   정책: 추가 ${totalAddedPolicies}개 / 스킵 ${totalSkippedPolicies}개`);
  if (dryRun) console.log(`\n실제 적용하려면 DRY_RUN 환경변수 빼고 다시 실행`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
