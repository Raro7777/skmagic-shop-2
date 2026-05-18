import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseFeature } from "@/lib/tier";
import { gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkBannerTier(partnerCode: string): Promise<NextResponse | null> {
  const partner = await prisma.partner.findUnique({
    where: { partnerCode },
    select: { tier: true },
  });
  if (!canUseFeature(partner?.tier ?? "basic", "banner_schedule")) {
    return NextResponse.json(
      { error: "이벤트 배너 편성은 스탠다드 패키지 이상에서 사용 가능합니다." },
      { status: 403 },
    );
  }
  return null;
}

// GET — 자기 협력점 배너 목록 (hq 는 cookie 기준 협력점)
export async function GET() {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const banners = await prisma.banner.findMany({
    where: { partnerId: eff.partnerId },
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
  });

  return NextResponse.json({
    partnerCode: eff.partnerId,
    banners: banners.map(b => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      imageUrl: b.imageUrl,
      bgColor1: b.bgColor1,
      bgColor2: b.bgColor2,
      textColor: b.textColor,
      ctaLabel: b.ctaLabel,
      ctaHref: b.ctaHref,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      priority: b.priority,
      status: b.status,
      layout: b.layout,
      spotlightProductCode: b.spotlightProductCode,
      stampText: b.stampText,
      htmlContent: b.htmlContent,
      sourceTemplateId: b.sourceTemplateId,
    })),
  });
}

// POST — 배너 등록
export async function POST(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }
  const tierBlock = await checkBannerTier(eff.partnerId);
  if (tierBlock) return tierBlock;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{
    title: string;
    subtitle: string | null;
    imageUrl: string | null;
    bgColor1: string;
    bgColor2: string;
    textColor: string;
    ctaLabel: string | null;
    ctaHref: string | null;
    startsAt: string;
    endsAt: string;
    priority: number;
    status: "draft" | "active";
    layout: "classic" | "image-bg" | "product-spotlight" | "promo-stamp" | "html" | "image-only";
    spotlightProductCode: string | null;
    stampText: string | null;
    htmlContent: string | null;
  }>;

  if (!b.title || !b.startsAt || !b.endsAt) {
    return NextResponse.json({ error: "title, startsAt, endsAt 필수" }, { status: 400 });
  }
  const startsAt = new Date(b.startsAt);
  const endsAt = new Date(b.endsAt);
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "유효하지 않은 날짜" }, { status: 400 });
  }
  if (startsAt >= endsAt) {
    return NextResponse.json({ error: "종료일은 시작일 이후여야 합니다" }, { status: 400 });
  }

  const allowedLayouts = ["classic", "image-bg", "product-spotlight", "promo-stamp", "html", "image-only"] as const;
  const layout = b.layout && (allowedLayouts as readonly string[]).includes(b.layout) ? b.layout : "classic";

  const banner = await prisma.banner.create({
    data: {
      partnerId: eff.partnerId,
      title: b.title.slice(0, 80),
      subtitle: b.subtitle?.slice(0, 120) ?? null,
      imageUrl: b.imageUrl?.slice(0, 512) ?? null,
      bgColor1: b.bgColor1?.slice(0, 16) ?? "#1A2B4D",
      bgColor2: b.bgColor2?.slice(0, 16) ?? "#F26A1F",
      textColor: b.textColor?.slice(0, 16) ?? "#FFFFFF",
      ctaLabel: b.ctaLabel?.slice(0, 40) ?? null,
      ctaHref: b.ctaHref?.slice(0, 256) ?? null,
      startsAt,
      endsAt,
      priority: typeof b.priority === "number" ? Math.max(0, Math.floor(b.priority)) : 0,
      status: b.status === "active" ? "active" : "draft",
      layout,
      spotlightProductCode: b.spotlightProductCode?.trim().slice(0, 32) || null,
      stampText: b.stampText?.trim().slice(0, 60) || null,
      htmlContent: b.htmlContent ? b.htmlContent.slice(0, 10000) : null,
    },
  });

  return NextResponse.json({ ok: true, id: banner.id });
}
