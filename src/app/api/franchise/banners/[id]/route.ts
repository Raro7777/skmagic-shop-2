import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkOwn(id: string, partnerId: string) {
  const b = await prisma.banner.findUnique({ where: { id } });
  if (!b) return null;
  if (b.partnerId !== partnerId) return "forbidden";
  return b;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const { id } = await ctx.params;
  const ownership = await checkOwn(id, eff.partnerId);
  if (!ownership) return NextResponse.json({ error: "Banner not found" }, { status: 404 });
  if (ownership === "forbidden") return NextResponse.json({ error: "Forbidden — 본인 협력점 배너만 수정 가능" }, { status: 403 });

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
    layout: "classic" | "image-bg" | "product-spotlight" | "promo-stamp" | "html";
    spotlightProductCode: string | null;
    stampText: string | null;
    htmlContent: string | null;
  }>;

  const data: Parameters<typeof prisma.banner.update>[0]["data"] = {};
  if (b.title != null) data.title = b.title.slice(0, 80);
  if (b.subtitle !== undefined) data.subtitle = b.subtitle == null ? null : b.subtitle.slice(0, 120);
  if (b.imageUrl !== undefined) data.imageUrl = b.imageUrl == null ? null : b.imageUrl.slice(0, 512);
  if (b.bgColor1) data.bgColor1 = b.bgColor1.slice(0, 16);
  if (b.bgColor2) data.bgColor2 = b.bgColor2.slice(0, 16);
  if (b.textColor) data.textColor = b.textColor.slice(0, 16);
  if (b.ctaLabel !== undefined) data.ctaLabel = b.ctaLabel == null ? null : b.ctaLabel.slice(0, 40);
  if (b.ctaHref !== undefined) data.ctaHref = b.ctaHref == null ? null : b.ctaHref.slice(0, 256);
  if (b.layout && ["classic", "image-bg", "product-spotlight", "promo-stamp", "html"].includes(b.layout)) {
    data.layout = b.layout;
  }
  if (b.spotlightProductCode !== undefined) {
    data.spotlightProductCode = b.spotlightProductCode?.trim().slice(0, 32) || null;
  }
  if (b.stampText !== undefined) {
    data.stampText = b.stampText?.trim().slice(0, 60) || null;
  }
  if (b.htmlContent !== undefined) {
    data.htmlContent = b.htmlContent == null ? null : b.htmlContent.slice(0, 10000);
  }
  if (b.startsAt) {
    const d = new Date(b.startsAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "유효하지 않은 startsAt" }, { status: 400 });
    data.startsAt = d;
  }
  if (b.endsAt) {
    const d = new Date(b.endsAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "유효하지 않은 endsAt" }, { status: 400 });
    data.endsAt = d;
  }
  if (typeof b.priority === "number") data.priority = Math.max(0, Math.floor(b.priority));
  if (b.status && ["draft", "active"].includes(b.status)) data.status = b.status;

  // 시간 관계 검증
  const newStarts = (data.startsAt as Date | undefined) ?? ownership.startsAt;
  const newEnds = (data.endsAt as Date | undefined) ?? ownership.endsAt;
  if (newStarts >= newEnds) {
    return NextResponse.json({ error: "종료일은 시작일 이후여야 합니다" }, { status: 400 });
  }

  await prisma.banner.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const { id } = await ctx.params;
  const ownership = await checkOwn(id, eff.partnerId);
  if (!ownership) return NextResponse.json({ error: "Banner not found" }, { status: 404 });
  if (ownership === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.banner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
