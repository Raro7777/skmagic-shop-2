/**
 * GET — 누구나(로그인 사용자) 읽기. 본사가 입력한 SK매직 가입조건 fact sheet.
 *        영업자/협력점/본사 모두 같은 fact sheet 조회 (상담 중 즉시 확인용).
 * PATCH — HQ 전용. 본사가 가입조건 갱신.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const setting = await prisma.hqSetting.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    joinConditions: setting?.joinConditions ?? null,
    updatedAt: setting?.updatedAt ?? null,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") {
    return NextResponse.json({ error: "Forbidden — 본사 슈퍼관리자만" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{
    ageMin: number;
    ageMax: number;
    creditGrade: string;
    paymentMethods: string;
    helpCallNumber: string;
    memo: string;
  }>;

  // 가벼운 sanitize — 자유 텍스트 위주이므로 길이만 cap.
  const clean = (v: unknown, len: number) =>
    typeof v === "string" ? v.trim().slice(0, len) || null : null;
  const cleanInt = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 && n <= 200 ? n : null;
  };

  const payload = {
    ageMin: cleanInt(b.ageMin),
    ageMax: cleanInt(b.ageMax),
    creditGrade: clean(b.creditGrade, 80),
    paymentMethods: clean(b.paymentMethods, 200),
    helpCallNumber: clean(b.helpCallNumber, 24),
    memo: clean(b.memo, 600),
  };

  await prisma.hqSetting.upsert({
    where: { id: 1 },
    create: { id: 1, joinConditions: payload, updatedById: session.user.id },
    update: { joinConditions: payload, updatedById: session.user.id },
  });

  return NextResponse.json({ ok: true, joinConditions: payload });
}
