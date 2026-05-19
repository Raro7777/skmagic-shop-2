import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_LAYOUTS = ["classic", "image-bg", "product-spotlight", "promo-stamp", "image-only"];

async function requireHq() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "hq") return { err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireHq();
  if ("err" in g) return g.err;
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{
    name: string; description: string | null; category: string | null;
    layout: string; title: string; subtitle: string | null; imageUrl: string | null;
    bgColor1: string; bgColor2: string; textColor: string;
    ctaLabel: string | null; ctaHref: string | null;
    fullClickable: boolean;
    stampText: string | null; spotlightProductCode: string | null;
    status: "active" | "archived";
  }>;

  const data: Parameters<typeof prisma.bannerTemplate.update>[0]["data"] = {};
  if (b.name != null) data.name = b.name.slice(0, 80);
  if (b.description !== undefined) data.description = b.description?.slice(0, 200) || null;
  if (b.category !== undefined) data.category = b.category?.slice(0, 40) || null;
  if (b.layout && ALLOWED_LAYOUTS.includes(b.layout)) data.layout = b.layout;
  if (b.title != null) data.title = b.title.slice(0, 80);
  if (b.subtitle !== undefined) data.subtitle = b.subtitle?.slice(0, 120) || null;
  if (b.imageUrl !== undefined) data.imageUrl = b.imageUrl?.slice(0, 512) || null;
  if (b.bgColor1) data.bgColor1 = b.bgColor1.slice(0, 16);
  if (b.bgColor2) data.bgColor2 = b.bgColor2.slice(0, 16);
  if (b.textColor) data.textColor = b.textColor.slice(0, 16);
  if (b.ctaLabel !== undefined) data.ctaLabel = b.ctaLabel?.slice(0, 40) || null;
  if (b.ctaHref !== undefined) data.ctaHref = b.ctaHref?.slice(0, 256) || null;
  if (b.fullClickable !== undefined) data.fullClickable = !!b.fullClickable;
  if (b.stampText !== undefined) data.stampText = b.stampText?.slice(0, 60) || null;
  if (b.spotlightProductCode !== undefined) data.spotlightProductCode = b.spotlightProductCode?.slice(0, 32) || null;
  if (b.status && ["active", "archived"].includes(b.status)) data.status = b.status;

  await prisma.bannerTemplate.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireHq();
  if ("err" in g) return g.err;
  const { id } = await ctx.params;
  await prisma.bannerTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
