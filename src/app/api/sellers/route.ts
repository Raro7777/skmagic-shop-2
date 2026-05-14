import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HQ_VIEW_COOKIE, gatePartnerOrHq } from "@/lib/effectivePartner";
import { normalizeKoreanPhone } from "@/lib/sellerPhone";

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
  const b = body as Partial<{
    name: string;
    phone: string;
    email: string;
  }>;

  if (!b.name?.trim() || !b.phone?.trim()) {
    return NextResponse.json({ error: "이름과 전화번호는 필수입니다." }, { status: 400 });
  }
  const normalizedPhone = normalizeKoreanPhone(b.phone);
  if (!normalizedPhone) {
    return NextResponse.json(
      { error: "전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)" },
      { status: 400 }
    );
  }
  // sellerCode = 정규화된 전화번호 — URL `/p/[code]/s/<phone>` 에 그대로 들어감
  const code = normalizedPhone;

  try {
    const created = await prisma.seller.create({
      data: {
        partnerId: eff.partnerId,
        sellerCode: code,
        name: b.name.trim().slice(0, 32),
        phone: normalizedPhone,
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
      return NextResponse.json({ error: "이미 등록된 전화번호입니다." }, { status: 400 });
    }
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}
