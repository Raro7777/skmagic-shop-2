import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{
    action: "rotateKey" | "setStatus" | "updateCategories";
    status: "active" | "disabled";
    allowedCategories: string[];
  }>;

  const partner = await prisma.apiPartner.findUnique({ where: { id } });
  if (!partner) return NextResponse.json({ error: "ApiPartner not found" }, { status: 404 });

  if (b.action === "rotateKey") {
    const newKey = "rk_" + crypto.randomBytes(24).toString("base64url");
    await prisma.apiPartner.update({ where: { id }, data: { apiKey: newKey } });
    return NextResponse.json({
      ok: true,
      apiKey: newKey,
      message: "새 API 키가 발급되었습니다. 외부 사이트에 즉시 갱신하세요. 이전 키는 즉시 폐기됩니다.",
    });
  }

  if (b.action === "setStatus") {
    if (!b.status || !["active", "disabled"].includes(b.status)) {
      return NextResponse.json({ error: "status: active | disabled" }, { status: 400 });
    }
    await prisma.apiPartner.update({ where: { id }, data: { status: b.status } });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "updateCategories") {
    const cats = Array.isArray(b.allowedCategories)
      ? b.allowedCategories.filter(c => typeof c === "string" && /^[a-z]+$/.test(c)).slice(0, 8)
      : [];
    await prisma.apiPartner.update({ where: { id }, data: { allowedCategories: cats } });
    return NextResponse.json({ ok: true, allowedCategories: cats });
  }

  return NextResponse.json({ error: "유효하지 않은 action" }, { status: 400 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  await prisma.apiPartner.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
