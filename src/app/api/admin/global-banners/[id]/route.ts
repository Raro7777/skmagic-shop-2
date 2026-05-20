import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyHq, esc } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_LAYOUTS = ["classic", "image-bg", "product-spotlight", "promo-stamp", "image-only"] as const;

async function requireHq() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "hq") return { err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

async function loadGlobal(id: string) {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner || banner.scope !== "global") return null;
  return banner;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireHq();
  if ("err" in g) return g.err;
  const { id } = await ctx.params;
  const banner = await loadGlobal(id);
  if (!banner) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const data: Parameters<typeof prisma.banner.update>[0]["data"] = {};
  if (b.title != null) data.title = b.title.slice(0, 80);
  if (b.subtitle !== undefined) data.subtitle = b.subtitle?.slice(0, 120) ?? null;
  if (b.imageUrl !== undefined) data.imageUrl = b.imageUrl?.slice(0, 512) ?? null;
  if (b.bgColor1) data.bgColor1 = b.bgColor1.slice(0, 16);
  if (b.bgColor2) data.bgColor2 = b.bgColor2.slice(0, 16);
  if (b.textColor) data.textColor = b.textColor.slice(0, 16);
  if (b.ctaLabel !== undefined) data.ctaLabel = b.ctaLabel?.slice(0, 40) ?? null;
  if (b.ctaHref !== undefined) data.ctaHref = b.ctaHref?.slice(0, 256) ?? null;
  if (b.startsAt) {
    const d = new Date(b.startsAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "startsAt 형식 오류" }, { status: 400 });
    data.startsAt = d;
  }
  if (b.endsAt) {
    const d = new Date(b.endsAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "endsAt 형식 오류" }, { status: 400 });
    data.endsAt = d;
  }
  if (typeof b.priority === "number") data.priority = Math.max(0, Math.floor(b.priority));
  if (b.status && ["draft", "active"].includes(b.status)) data.status = b.status;
  if (b.layout && (ALLOWED_LAYOUTS as readonly string[]).includes(b.layout)) data.layout = b.layout;
  if (b.spotlightProductCode !== undefined) data.spotlightProductCode = b.spotlightProductCode?.trim().slice(0, 32) || null;
  if (b.stampText !== undefined) data.stampText = b.stampText?.trim().slice(0, 60) || null;
  if (b.htmlContent !== undefined) data.htmlContent = b.htmlContent ? b.htmlContent.slice(0, 10000) : null;

  const updated = await prisma.banner.update({ where: { id }, data });

  // draft → active 전환 (= 🚀 푸시) 시 협력점 공지 + 텔레그램 알림.
  // 이미 active 인 row 수정 시에는 발송 안 함.
  if (banner.status !== "active" && updated.status === "active") {
    const periodStr = `${updated.startsAt.toISOString().slice(0, 10)} ~ ${updated.endsAt.toISOString().slice(0, 10)}`;
    void prisma.broadcast.create({
      data: {
        tone: "event",
        badge: "📢 본사 공통 배너",
        title: `본사 공통 배너 게시 — ${updated.title}`,
        body: `본사가 모든 활성 협력점 컨슈머 사이트에 ${updated.title} 배너를 게시했습니다. 노출 기간 ${periodStr}. 협력점 콘솔의 디자인 페이지에서 본사 공통 배너 섹션을 확인하세요. (본인 사이트에서 숨기려면 해당 카드의 🙈 숨김 토글)`,
        createdById: g.session.user.id,
      },
    }).catch(() => { /* ignore */ });
    notifyHq(
      `📢 <b>본사 공통 배너 게시</b>\n` +
        `제목: ${esc(updated.title)}\n` +
        `기간: ${periodStr}\n` +
        `priority: ${updated.priority}\n` +
        `\n전 활성 협력점 컨슈머 사이트의 메인 슬라이드에 즉시 노출됩니다 (협력점이 본인 사이트에서 숨김 가능).`,
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireHq();
  if ("err" in g) return g.err;
  const { id } = await ctx.params;
  const banner = await loadGlobal(id);
  if (!banner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.banner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
