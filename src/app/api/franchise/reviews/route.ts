import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 협력점 후기 — 자신의 점 후기 리스트
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const eff = await gatePartnerOrHq();
  if ("error" in eff) return NextResponse.json({ error: eff.error }, { status: 403 });

  const rows = await prisma.review.findMany({
    where: { partnerId: eff.partnerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { productCode: true, name: true } } },
  });
  return NextResponse.json({
    items: rows.map(r => ({
      id: r.id,
      productCode: r.product?.productCode ?? null,
      productName: r.product?.name ?? null,
      customerName: r.customerName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      installPhotoUrl: r.installPhotoUrl,
      region: r.region,
      approvalStatus: r.approvalStatus,
      rejectReason: r.rejectReason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      approvedAt: r.approvedAt?.toISOString() ?? null,
    })),
  });
}

// 협력점 후기 등록 — approvalStatus 'pending' 으로 저장, 본사 승인 대기
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const eff = await gatePartnerOrHq();
  if ("error" in eff) return NextResponse.json({ error: eff.error }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const b = body as Partial<{
    productCode: string;
    customerName: string;
    rating: number;
    title: string;
    body: string;
    installPhotoUrl: string;
    region: string;
    selectedMode: string;
    selectedContractPeriod: number;
  }>;

  if (!b.customerName?.trim() || !b.body?.trim()) {
    return NextResponse.json({ error: "고객 이름과 후기 본문은 필수입니다." }, { status: 400 });
  }
  const rating = Math.max(1, Math.min(5, Math.floor(b.rating ?? 5)));

  let productId: string | null = null;
  if (b.productCode?.trim()) {
    const p = await prisma.product.findUnique({ where: { productCode: b.productCode.trim() }, select: { id: true } });
    productId = p?.id ?? null;
  }

  const created = await prisma.review.create({
    data: {
      productId,
      partnerId: eff.partnerId,
      customerName: b.customerName.trim().slice(0, 32),
      rating,
      title: b.title?.trim().slice(0, 80) || null,
      body: b.body.trim().slice(0, 2000),
      installPhotoUrl: b.installPhotoUrl?.trim() || null,
      region: b.region?.trim().slice(0, 32) || null,
      selectedMode: b.selectedMode === "방문형" || b.selectedMode === "셀프형" ? b.selectedMode : null,
      selectedContractPeriod: typeof b.selectedContractPeriod === "number" ? Math.floor(b.selectedContractPeriod) : null,
      approvalStatus: "pending",
      submittedById: session.user.id ?? null,
      submittedByRole: session.user.role ?? "partner_admin",
      isVerified: false,
      status: "published",
    },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
