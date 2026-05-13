import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — list broadcasts (any logged-in user). Most recent first, exclude archived by default.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20);

  const rows = await prisma.broadcast.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    broadcasts: rows.map(b => ({
      id: b.id,
      tone: b.tone,
      badge: b.badge,
      title: b.title,
      body: b.body,
      reach: b.reach,
      createdAt: b.createdAt.toISOString(),
      archivedAt: b.archivedAt?.toISOString() ?? null,
      ageMinutes: Math.floor((Date.now() - b.createdAt.getTime()) / 60000),
    })),
  });
}

// POST — HQ creates a new broadcast
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden — 본사 관리자만 작성 가능" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ tone: string; badge: string; title: string; body: string; reach: string }>;

  if (!b.title?.trim() || !b.body?.trim() || !b.badge?.trim()) {
    return NextResponse.json({ error: "필수 항목 누락 (badge·title·body)" }, { status: 400 });
  }
  const tone = b.tone && ["default", "urgent", "event"].includes(b.tone) ? b.tone : "default";

  // Auto-fill reach if not provided
  let reach = b.reach?.slice(0, 200) ?? null;
  if (!reach) {
    const partnerCount = await prisma.partner.count({ where: { status: "active" } });
    reach = `📊 발송 대상 협력점 ${partnerCount}개`;
  }

  const created = await prisma.broadcast.create({
    data: {
      tone,
      badge: b.badge.trim().slice(0, 64),
      title: b.title.trim().slice(0, 200),
      body: b.body.trim().slice(0, 2000),
      reach,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    broadcast: { id: created.id, title: created.title },
  });
}
