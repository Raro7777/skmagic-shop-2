import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gateHq() {
  const session = await auth();
  if (!session?.user) return { error: "unauthorized" as const, status: 401 };
  if (session.user.role !== "hq") return { error: "forbidden" as const, status: 403 };
  return { user: session.user };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gateHq();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const b = body as Partial<{ customerName: string; productName: string; region: string | null; status: string; minutesAgo: number; priority: number; isActive: boolean }>;
  const data: Parameters<typeof prisma.liveActivity.update>[0]["data"] = {};
  if (b.customerName != null) data.customerName = b.customerName.trim().slice(0, 40);
  if (b.productName != null) data.productName = b.productName.trim().slice(0, 80);
  if (b.region !== undefined) data.region = b.region?.trim().slice(0, 40) || null;
  if (b.status != null && ["접수완료", "상담대기", "설치완료"].includes(b.status)) data.status = b.status;
  if (typeof b.minutesAgo === "number") data.minutesAgo = Math.max(0, Math.floor(b.minutesAgo));
  if (typeof b.priority === "number") data.priority = Math.max(0, Math.floor(b.priority));
  if (typeof b.isActive === "boolean") data.isActive = b.isActive;
  await prisma.liveActivity.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gateHq();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await ctx.params;
  await prisma.liveActivity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
