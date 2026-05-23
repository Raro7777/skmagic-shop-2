/**
 * 본사 슈퍼관리자가 협력점 콘솔에 임시 진입할 때 사용하는 cookie 핸들러.
 *  - POST { partnerCode }  → hq_view_partner cookie 설정 + active 협력점 검증
 *  - DELETE                → cookie 제거 (본사 콘솔로 복귀)
 *
 * 호출자 role 은 반드시 "hq". 그 외 403.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HQ_VIEW_COOKIE } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden — 본사 슈퍼관리자만" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ partnerCode: string }>;
  if (!b.partnerCode?.trim()) return NextResponse.json({ error: "partnerCode 필수" }, { status: 400 });

  const p = await prisma.partner.findUnique({
    where: { partnerCode: b.partnerCode.trim() },
    select: { partnerCode: true, partnerName: true, status: true },
  });
  if (!p) return NextResponse.json({ error: "협력점을 찾을 수 없습니다." }, { status: 404 });
  // hq_template 은 본사 표준 메인페이지 편집용 special row. active 와 동일하게 진입 허용.
  if (p.status !== "active" && p.status !== "hq_template") {
    return NextResponse.json({ error: "active 협력점만 진입 가능합니다." }, { status: 400 });
  }

  const c = await cookies();
  c.set(HQ_VIEW_COOKIE, p.partnerCode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h
  });

  return NextResponse.json({ ok: true, partnerCode: p.partnerCode, partnerName: p.partnerName });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const c = await cookies();
  c.delete(HQ_VIEW_COOKIE);
  return NextResponse.json({ ok: true });
}
