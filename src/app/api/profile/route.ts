/**
 * PATCH /api/profile — 로그인 사용자 본인의 프로필 변경 (모든 role).
 *
 * 변경 가능 필드:
 *   - name        : User.name (+ seller 면 Seller.name 동기화)
 *   - email       : User.email (= 로그인 ID, unique 검증) (+ seller 면 Seller.email 동기화)
 *   - phone       : seller 만 — Seller.phone 변경
 *
 * 비밀번호 변경은 /api/profile/password 별도 endpoint.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeKoreanPhone } from "@/lib/sellerPhone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ name: string; email: string; phone: string }>;

  const data: { name?: string; email?: string } = {};

  if (b.name !== undefined) {
    const t = b.name.trim();
    if (!t) return NextResponse.json({ error: "이름은 비울 수 없습니다." }, { status: 400 });
    data.name = t.slice(0, 40);
  }

  if (b.email !== undefined) {
    const raw = b.email.trim().toLowerCase();
    if (!raw) return NextResponse.json({ error: "이메일은 비울 수 없습니다." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const taken = await prisma.user.findUnique({ where: { email: raw }, select: { id: true } });
    if (taken && taken.id !== session.user.id) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }
    data.email = raw;
  }

  // 전화는 영업자만 — Seller.phone 변경
  let normalizedPhone: string | null | undefined;
  if (b.phone !== undefined) {
    if (session.user.role !== "seller") {
      return NextResponse.json({ error: "전화번호는 영업자만 본인 프로필에서 변경할 수 있습니다." }, { status: 403 });
    }
    const raw = b.phone.trim();
    if (!raw) {
      normalizedPhone = null;
    } else {
      const norm = normalizeKoreanPhone(raw);
      if (!norm) return NextResponse.json({ error: "전화번호 형식이 올바르지 않습니다." }, { status: 400 });
      normalizedPhone = norm;
    }
  }

  if (Object.keys(data).length === 0 && normalizedPhone === undefined) {
    return NextResponse.json({ error: "변경된 필드가 없습니다." }, { status: 400 });
  }

  // 트랜잭션 — User + (seller 면) 연결된 Seller 동기화
  await prisma.$transaction(async tx => {
    if (Object.keys(data).length > 0) {
      await tx.user.update({ where: { id: session.user.id }, data });
    }
    if (session.user.role === "seller") {
      const sellerData: { name?: string; email?: string | null; phone?: string | null } = {};
      if (data.name !== undefined) sellerData.name = data.name;
      if (data.email !== undefined) sellerData.email = data.email;
      if (normalizedPhone !== undefined) sellerData.phone = normalizedPhone;
      if (Object.keys(sellerData).length > 0) {
        await tx.seller.updateMany({ where: { userId: session.user.id }, data: sellerData });
      }
    }
  });

  return NextResponse.json({
    ok: true,
    profile: {
      name: data.name,
      email: data.email,
      phone: normalizedPhone,
    },
  });
}
