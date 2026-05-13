import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH — HQ marks duplicateStatus (confirmed | bad_db | null cleared)
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
  const b = body as Partial<{ verdict: "confirmed" | "bad_db" | "clear" }>;
  if (!b.verdict || !["confirmed", "bad_db", "clear"].includes(b.verdict)) {
    return NextResponse.json({ error: "verdict 필수: confirmed | bad_db | clear" }, { status: 400 });
  }

  const newStatus = b.verdict === "clear" ? null : b.verdict;

  try {
    await prisma.lead.update({
      where: { id },
      data: { duplicateStatus: newStatus },
    });
    return NextResponse.json({ ok: true, duplicateStatus: newStatus });
  } catch {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
}
