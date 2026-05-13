import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HQ_VIEW_COOKIE, gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — list sellers (partner_admin: own only, hq: all 또는 협력점 콘솔 호출 시 cookie scope)
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const partnerCodeFilter = url.searchParams.get("partnerCode");

  let where: { partnerId?: string } = {};
  if (session.user.role === "partner_admin") {
    if (!session.user.partnerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    where.partnerId = session.user.partnerId;
  } else if (session.user.role === "hq") {
    if (partnerCodeFilter) {
      where.partnerId = partnerCodeFilter;
    } else {
      const c = await cookies();
      const cookieVal = c.get(HQ_VIEW_COOKIE)?.value;
      const referer = req.headers.get("referer") ?? "";
      if (cookieVal && referer.includes("/admin/franchise")) {
        where.partnerId = cookieVal;
      }
    }
  }

  const rows = await prisma.seller.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { leads: true } },
    },
  });

  return NextResponse.json({
    sellers: rows.map(r => ({
      id: r.id,
      sellerCode: r.sellerCode,
      partnerId: r.partnerId,
      name: r.name,
      phone: r.phone,
      email: r.email,
      status: r.status,
      leadCount: r._count.leads,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

// POST — partner_admin creates a new seller in their partner (hq 협력점 콘솔 진입 시도 가능)
export async function POST(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ sellerCode: string; name: string; phone: string; email: string }>;

  if (!b.sellerCode?.trim() || !b.name?.trim()) {
    return NextResponse.json({ error: "sellerCode + name 필수" }, { status: 400 });
  }
  const code = b.sellerCode.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,32}$/.test(code)) {
    return NextResponse.json(
      { error: "sellerCode는 영문 소문자/숫자/하이픈 2~32자" },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.seller.create({
      data: {
        partnerId: eff.partnerId,
        sellerCode: code,
        name: b.name.trim().slice(0, 32),
        phone: b.phone?.trim() || null,
        email: b.email?.trim() || null,
        status: "active",
      },
    });
    return NextResponse.json({
      ok: true,
      seller: {
        id: created.id,
        sellerCode: created.sellerCode,
        name: created.name,
      },
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") {
      return NextResponse.json({ error: "이미 사용 중인 sellerCode 입니다." }, { status: 400 });
    }
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}
