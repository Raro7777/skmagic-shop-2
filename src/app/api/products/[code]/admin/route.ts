import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE — HQ marks product as discontinued (soft delete preserves PartnerPolicy and lead history)
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { code } = await ctx.params;
  try {
    await prisma.product.update({
      where: { productCode: code },
      data: { status: "discontinued" },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// PATCH — HQ updates product detail (description, images, features, specs, prices)
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden — 본사 관리자만 수정 가능" }, { status: 403 });
  }

  const { code } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Partial<{
    name: string;
    modelName: string;
    category: string;
    rentalPrice: number;
    cardDiscountPrice: number | null;
    contractPeriod: number;
    warrantyMonths: number;
    managementType: string;
    description: string | null;
    imageUrls: string[];
    keyFeatures: string[];
    specs: Record<string, string>;
    isFeatured: boolean;
    status: "active" | "discontinued";
  }>;

  // Sanitize/validate
  const data: Parameters<typeof prisma.product.update>[0]["data"] = {};
  if (b.name != null) data.name = b.name.trim().slice(0, 200);
  if (b.modelName != null) data.modelName = b.modelName.trim().slice(0, 64);
  if (b.category != null) data.category = b.category.trim().slice(0, 32);
  if (b.rentalPrice != null) data.rentalPrice = Math.max(0, Math.floor(b.rentalPrice));
  if (b.cardDiscountPrice !== undefined) {
    data.cardDiscountPrice = b.cardDiscountPrice == null ? null : Math.max(0, Math.floor(b.cardDiscountPrice));
  }
  if (b.contractPeriod != null) data.contractPeriod = Math.max(1, Math.floor(b.contractPeriod));
  if (b.warrantyMonths != null) data.warrantyMonths = Math.max(0, Math.floor(b.warrantyMonths));
  if (b.managementType != null) data.managementType = b.managementType.trim().slice(0, 64);
  if (b.description !== undefined) {
    data.description = b.description == null ? null : b.description.slice(0, 8000);
  }
  if (Array.isArray(b.imageUrls)) {
    data.imageUrls = b.imageUrls.filter(u => typeof u === "string" && u.trim()).map(u => u.trim().slice(0, 512)).slice(0, 12);
  }
  if (Array.isArray(b.keyFeatures)) {
    data.keyFeatures = b.keyFeatures.filter(f => typeof f === "string" && f.trim()).map(f => f.trim().slice(0, 200)).slice(0, 20);
  }
  if (b.specs && typeof b.specs === "object") {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(b.specs)) {
      const key = k.trim().slice(0, 64);
      if (key && typeof v === "string") cleaned[key] = v.trim().slice(0, 200);
    }
    data.specs = cleaned;
  }
  if (b.isFeatured != null) data.isFeatured = !!b.isFeatured;
  if (b.status != null && ["active", "discontinued"].includes(b.status)) data.status = b.status;

  try {
    const updated = await prisma.product.update({
      where: { productCode: code },
      data,
    });
    return NextResponse.json({
      ok: true,
      product: { productCode: updated.productCode, name: updated.name, status: updated.status },
    });
  } catch (e) {
    const ec = (e as { code?: string }).code;
    if (ec === "P2025") return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

// GET — full detail for HQ admin (includes hqPolicy)
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { code } = await ctx.params;
  const product = await prisma.product.findUnique({
    where: { productCode: code },
    include: { hqPolicy: true, _count: { select: { partnerPolicies: true } } },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  return NextResponse.json({
    product: {
      productCode: product.productCode,
      category: product.category,
      name: product.name,
      modelName: product.modelName,
      rentalPrice: product.rentalPrice,
      cardDiscountPrice: product.cardDiscountPrice,
      contractPeriod: product.contractPeriod,
      warrantyMonths: product.warrantyMonths,
      managementType: product.managementType,
      description: product.description,
      imageUrls: product.imageUrls,
      keyFeatures: product.keyFeatures,
      specs: product.specs,
      isFeatured: product.isFeatured,
      status: product.status,
    },
    hqPolicy: product.hqPolicy,
    partnerPolicyCount: product._count.partnerPolicies,
  });
}
