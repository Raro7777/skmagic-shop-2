import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeKoreanPhone } from "@/lib/sellerPhone";

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
    email: string;        // Seller.email — 영업자 연락용 (선택)
    loginEmail: string;   // User.email — 영업자 콘솔 로그인 ID (변경 시 unique 검증)
    status: string;
  }>;

  // phone 수정 시 정규화 (sellerCode = URL 은 변경하지 않음 — 기존 카톡 링크 보호)
  let nextPhone: string | null | undefined;
  if (b.phone !== undefined) {
    const raw = b.phone?.trim();
    if (!raw) {
      nextPhone = null;
    } else {
      const norm = normalizeKoreanPhone(raw);
      if (!norm) {
        return NextResponse.json({ error: "전화번호 형식이 올바르지 않습니다." }, { status: 400 });
      }
      nextPhone = norm;
    }
  }

  // 로그인 ID(이메일) 변경 — User 테이블의 unique email 변경.
  // 영업자 자체 user 가 없으면 (구버전 시드) 무시.
  let normalizedLoginEmail: string | undefined;
  if (b.loginEmail !== undefined) {
    const raw = b.loginEmail.trim().toLowerCase();
    if (!raw) {
      return NextResponse.json({ error: "로그인 ID는 비울 수 없습니다." }, { status: 400 });
    }
    // 표준 email regex (RFC 5322 의 단순화 버전)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
    }
    // 다른 user 가 이미 사용 중인지 확인
    const taken = await prisma.user.findUnique({ where: { email: raw }, select: { id: true } });
    if (taken && taken.id !== a.seller.userId) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }
    normalizedLoginEmail = raw;
  }

  const updated = await prisma.$transaction(async tx => {
    const seller = await tx.seller.update({
      where: { id },
      data: {
        ...(b.name != null && { name: b.name.trim().slice(0, 32) }),
        ...(nextPhone !== undefined && { phone: nextPhone }),
        ...(b.email !== undefined && { email: b.email?.trim() || null }),
        ...(b.status && ["active", "inactive"].includes(b.status) && { status: b.status }),
      },
    });
    if (normalizedLoginEmail !== undefined && seller.userId) {
      await tx.user.update({
        where: { id: seller.userId },
        data: { email: normalizedLoginEmail },
      });
    }
    return seller;
  });

  // 변경 후 현재 로그인 email 조회 — UI 가 업데이트된 ID 를 즉시 반영
  const currentLoginEmail = updated.userId
    ? (await prisma.user.findUnique({ where: { id: updated.userId }, select: { email: true } }))?.email ?? null
    : null;

  return NextResponse.json({
    ok: true,
    seller: { id: updated.id, status: updated.status, name: updated.name, loginEmail: currentLoginEmail },
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
