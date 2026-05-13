/**
 * 본문 이미지 개별 삭제 — Blob + DB row 동시 제거.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ code: string; id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { code, id } = await ctx.params;

  const img = await prisma.productContentImage.findUnique({
    where: { id },
    include: { product: { select: { productCode: true } } },
  });
  if (!img) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (img.product.productCode !== code) return NextResponse.json({ error: "mismatch" }, { status: 400 });

  // Blob 삭제 시도 (실패해도 DB row 는 지움 — 운영팀이 진짜 원하는 건 DB 정합성)
  try { await del(img.url); } catch { /* noop */ }

  await prisma.productContentImage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
