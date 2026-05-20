/**
 * GET /api/franchise/global-banners — 본사 공통 배너 read-only 조회.
 *
 * 협력점 콘솔(BannerSchedule) 상단에 "📢 본사 공통 배너" 섹션 노출용.
 * 협력점은 수정/삭제 불가. 본사 정책으로 강제 push 됨을 안내.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const [banners, partner] = await Promise.all([
    prisma.banner.findMany({
      where: { scope: "global" },
      orderBy: [{ status: "asc" }, { startsAt: "desc" }],
      take: 30,
    }),
    prisma.partner.findUnique({
      where: { partnerCode: eff.partnerId },
      select: { displayConfig: true },
    }),
  ]);
  const hiddenSet = new Set(
    ((partner?.displayConfig as { hiddenGlobalBannerIds?: string[] } | null)?.hiddenGlobalBannerIds ?? [])
      .filter((x): x is string => typeof x === "string"),
  );

  return NextResponse.json({
    banners: banners.map(b => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      imageUrl: b.imageUrl,
      bgColor1: b.bgColor1,
      bgColor2: b.bgColor2,
      textColor: b.textColor,
      ctaLabel: b.ctaLabel,
      // 협력점 화면에는 치환되지 않은 raw 노출 (어떤 패턴인지 보기용).
      // 실제 컨슈머 렌더는 partnerSite.ts 에서 본인 partnerCode 로 치환됨.
      ctaHref: b.ctaHref,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      priority: b.priority,
      status: b.status,
      layout: b.layout,
      hidden: hiddenSet.has(b.id),
    })),
  });
}
