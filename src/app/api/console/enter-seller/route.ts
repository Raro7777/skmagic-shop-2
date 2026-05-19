/**
 * POST /api/console/enter-seller — 영업자 콘솔 임시 진입(impersonation) cookie 세팅.
 *   - hq: 어느 협력점 영업자든 통과.
 *   - partner_admin: 본인 partnerId 소속 영업자만 통과.
 *   - seller / 기타: 거절.
 *
 * Body: { sellerId: string }
 * Response: { ok: true, redirect: "/admin/seller" }
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SELLER_VIEW_COOKIE } from "@/lib/effectiveSeller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq" && session.user.role !== "partner_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sellerId = (body as { sellerId?: string }).sellerId?.trim();
  if (!sellerId) return NextResponse.json({ error: "sellerId 필수" }, { status: 400 });

  const target = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { id: true, partnerId: true, status: true, name: true },
  });
  if (!target || target.status !== "active") {
    return NextResponse.json({ error: "활성 영업자 아님" }, { status: 404 });
  }
  if (session.user.role === "partner_admin" && target.partnerId !== session.user.partnerId) {
    return NextResponse.json({ error: "본인 협력점 소속 영업자만 진입 가능" }, { status: 403 });
  }

  const c = await cookies();
  c.set(SELLER_VIEW_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8시간
  });

  return NextResponse.json({ ok: true, redirect: "/admin/seller", sellerName: target.name });
}
