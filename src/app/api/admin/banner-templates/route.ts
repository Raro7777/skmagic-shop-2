/**
 * /api/admin/banner-templates — 본사 표준 배너 템플릿 CRUD.
 *   GET  : HQ + 협력점 (협력점은 active 만 조회)
 *   POST : HQ 전용 (생성)
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_LAYOUTS = ["classic", "image-bg", "product-spotlight", "promo-stamp", "image-only"] as const;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // hq 와 partner_admin 모두 접근 가능 (협력점은 active 만)
  const isHq = session.user.role === "hq";

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? (isHq ? null : "active");

  const templates = await prisma.bannerTemplate.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden — 본사 전용" }, { status: 403 });

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

  if (!b.name?.trim() || !b.title?.trim()) {
    return NextResponse.json({ error: "name, title 필수" }, { status: 400 });
  }
  const layout = b.layout && (ALLOWED_LAYOUTS as readonly string[]).includes(b.layout) ? b.layout : "classic";

  const created = await prisma.bannerTemplate.create({
    data: {
      name: b.name.trim().slice(0, 80),
      description: b.description?.trim().slice(0, 200) || null,
      category: b.category?.trim().slice(0, 40) || null,
      layout,
      title: b.title.trim().slice(0, 80),
      subtitle: b.subtitle?.trim().slice(0, 120) || null,
      imageUrl: b.imageUrl?.trim().slice(0, 512) || null,
      bgColor1: b.bgColor1?.slice(0, 16) ?? "#1A2B4D",
      bgColor2: b.bgColor2?.slice(0, 16) ?? "#F26A1F",
      textColor: b.textColor?.slice(0, 16) ?? "#FFFFFF",
      ctaLabel: b.ctaLabel?.trim().slice(0, 40) || null,
      ctaHref: b.ctaHref?.trim().slice(0, 256) || null,
      fullClickable: !!b.fullClickable,
      stampText: b.stampText?.trim().slice(0, 60) || null,
      spotlightProductCode: b.spotlightProductCode?.trim().slice(0, 32) || null,
      status: b.status === "archived" ? "archived" : "active",
      createdById: session.user.id,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
