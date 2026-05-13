import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH — HQ archives/unarchives a broadcast
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ archive: boolean }>;

  try {
    const updated = await prisma.broadcast.update({
      where: { id },
      data: { archivedAt: b.archive ? new Date() : null },
    });
    return NextResponse.json({ ok: true, archivedAt: updated.archivedAt?.toISOString() ?? null });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
