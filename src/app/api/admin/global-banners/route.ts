/**
 * /api/admin/global-banners — 본사 공통 배너 CRUD.
 *   - 모든 활성 협력점 컨슈머 사이트의 메인 슬라이드에 자동 노출.
 *   - scope="global", partnerId=null.
 *   - priority 는 본사 우선 — 기본 100 (협력점 배너보다 위).
 *   - ctaHref 에 {partnerCode} 플레이스홀더 사용 시 컨슈머 렌더 시점에 치환.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyHq, esc } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_LAYOUTS = ["classic", "image-bg", "product-spotlight", "promo-stamp", "image-only"] as const;
const DEFAULT_GLOBAL_PRIORITY = 100;

async function requireHq() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "hq") return { err: NextResponse.json({ error: "Forbidden — 본사 전용" }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const g = await requireHq();
  if ("err" in g) return g.err;

  const banners = await prisma.banner.findMany({
    where: { scope: "global" },
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
  });
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
      ctaHref: b.ctaHref,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      priority: b.priority,
      status: b.status,
      layout: b.layout,
      spotlightProductCode: b.spotlightProductCode,
      stampText: b.stampText,
      htmlContent: b.htmlContent,
    })),
  });
}

export async function POST(req: Request) {
  const g = await requireHq();
  if ("err" in g) return g.err;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{
    title: string; subtitle: string | null; imageUrl: string | null;
    bgColor1: string; bgColor2: string; textColor: string;
    ctaLabel: string | null; ctaHref: string | null;
    startsAt: string; endsAt: string;
    priority: number; status: "draft" | "active";
    layout: typeof ALLOWED_LAYOUTS[number];
    spotlightProductCode: string | null; stampText: string | null; htmlContent: string | null;
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
  const layout = b.layout && (ALLOWED_LAYOUTS as readonly string[]).includes(b.layout) ? b.layout : "classic";

  const banner = await prisma.banner.create({
    data: {
      scope: "global",
      partnerId: null,
      title: b.title.slice(0, 80),
      subtitle: b.subtitle?.slice(0, 120) ?? null,
      imageUrl: b.imageUrl?.slice(0, 512) ?? null,
      bgColor1: b.bgColor1?.slice(0, 16) ?? "#1A2B4D",
      bgColor2: b.bgColor2?.slice(0, 16) ?? "#F26A1F",
      textColor: b.textColor?.slice(0, 16) ?? "#FFFFFF",
      ctaLabel: b.ctaLabel?.slice(0, 40) ?? null,
      ctaHref: b.ctaHref?.slice(0, 256) ?? null,
      startsAt, endsAt,
      // 본사 우선 — 사용자 결정 4=a. priority 기본 100 (협력점은 기본 0).
      priority: typeof b.priority === "number" ? Math.max(0, Math.floor(b.priority)) : DEFAULT_GLOBAL_PRIORITY,
      status: b.status === "active" ? "active" : "draft",
      layout,
      spotlightProductCode: b.spotlightProductCode?.trim().slice(0, 32) || null,
      stampText: b.stampText?.trim().slice(0, 60) || null,
      htmlContent: b.htmlContent ? b.htmlContent.slice(0, 10000) : null,
    },
  });

  // Phase 5 — 본사 배너 active 생성 시 협력점 콘솔 공지 자동 생성 (사용자 결정 5).
  // draft 면 게시 전이라 공지 생략.
  if (banner.status === "active") {
    const periodStr = `${banner.startsAt.toISOString().slice(0, 10)} ~ ${banner.endsAt.toISOString().slice(0, 10)}`;
    void prisma.broadcast.create({
      data: {
        tone: "event",
        badge: "📢 본사 공통 배너",
        title: `본사 공통 배너 게시 — ${banner.title}`,
        body: `본사가 모든 활성 협력점 컨슈머 사이트에 ${banner.title} 배너를 게시했습니다. 노출 기간 ${periodStr}. 협력점 콘솔의 디자인 페이지에서 본사 공통 배너 섹션을 확인하세요.`,
        createdById: g.session.user.id,
      },
    }).catch(() => { /* 공지 생성 실패는 배너 생성 자체에 영향 없음 */ });

    // 텔레그램 알림 — 본사 그룹에 게시 사실 통지 (fire-and-forget).
    notifyHq(
      `📢 <b>본사 공통 배너 게시</b>\n` +
        `제목: ${esc(banner.title)}\n` +
        `기간: ${periodStr}\n` +
        `priority: ${banner.priority}\n` +
        `\n전 활성 협력점 컨슈머 사이트의 메인 슬라이드에 즉시 노출됩니다.`,
    );
  }

  return NextResponse.json({ ok: true, id: banner.id });
}
