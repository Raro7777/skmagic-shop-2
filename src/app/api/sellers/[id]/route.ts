import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(id: string) {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const seller = await prisma.seller.findUnique({ where: { id } });
  if (!seller) return { error: NextResponse.json({ error: "Seller not found" }, { status: 404 }) };

  if (session.user.role === "partner_admin" && seller.partnerId !== session.user.partnerId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (session.user.role !== "partner_admin" && session.user.role !== "hq") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { seller, session };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const a = await authorize(id);
  if ("error" in a) return a.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{
    name: string;
    phone: string;
    email: string;
    status: string;
  }>;

  const updated = await prisma.seller.update({
    where: { id },
    data: {
      ...(b.name != null && { name: b.name.trim().slice(0, 32) }),
      ...(b.phone !== undefined && { phone: b.phone?.trim() || null }),
      ...(b.email !== undefined && { email: b.email?.trim() || null }),
      ...(b.status && ["active", "inactive"].includes(b.status) && { status: b.status }),
    },
  });
  return NextResponse.json({
    ok: true,
    seller: { id: updated.id, status: updated.status, name: updated.name },
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const a = await authorize(id);
  if ("error" in a) return a.error;

  // Soft delete (preserve historical lead linkage)
  await prisma.seller.update({ where: { id }, data: { status: "inactive" } });
  return NextResponse.json({ ok: true });
}
