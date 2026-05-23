/**
 * 영업자 본인의 푸터 override 편집 — 본인 컨슈머 페이지(/p/[partner]/s/[seller])의
 * 푸터에만 적용. 각 필드 null/빈 문자열이면 협력점 값으로 폴백.
 *
 * 본인만 자기 Seller 행을 수정 가능 (session.user.id ↔ Seller.userId).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gateSelf() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "seller") {
    return { err: NextResponse.json({ error: "영업자 본인만" }, { status: 403 }) };
  }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!seller) return { err: NextResponse.json({ error: "Seller row not found" }, { status: 404 }) };
  return { sellerId: seller.id };
}

const FIELDS = [
  "companyName", "ownerName", "address", "businessNumber", "commerceNumber",
  "hotlineNumber", "csHours", "csLunchHours", "csHolidays", "kakaoChannelUrl",
] as const;

export async function GET() {
  const g = await gateSelf();
  if ("err" in g) return g.err;
  const seller = await prisma.seller.findUnique({
    where: { id: g.sellerId },
    select: Object.fromEntries(FIELDS.map(f => [f, true])) as Record<typeof FIELDS[number], true>,
  });
  return NextResponse.json({ footer: seller });
}

export async function PATCH(req: Request) {
  const g = await gateSelf();
  if ("err" in g) return g.err;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<Record<typeof FIELDS[number], string>>;

  // 각 필드 trim + 길이 cap + 빈 문자열 → null (협력점 값으로 폴백).
  const data: Record<string, string | null> = {};
  for (const field of FIELDS) {
    if (b[field] === undefined) continue;
    const raw = (b[field] ?? "").trim();
    data[field] = raw ? raw.slice(0, field === "address" ? 200 : 80) : null;
  }

  // 카카오 URL 형식 검증
  if (data.kakaoChannelUrl) {
    if (!/^https?:\/\//.test(data.kakaoChannelUrl)) {
      return NextResponse.json({ error: "카카오 채널 URL 은 http:// 또는 https:// 로 시작해야 합니다." }, { status: 400 });
    }
  }
  // 전화번호 형식 (빈 값 허용)
  if (data.hotlineNumber && !/^[\d\-+\s()]+$/.test(data.hotlineNumber)) {
    return NextResponse.json({ error: "고객센터 번호 형식 오류 (숫자·하이픈만)" }, { status: 400 });
  }
  // 사업자번호 형식 (빈 값 허용)
  if (data.businessNumber && !/^[\d\-\s]{8,20}$/.test(data.businessNumber)) {
    return NextResponse.json({ error: "사업자등록번호 형식 오류" }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경된 필드가 없습니다." }, { status: 400 });
  }

  await prisma.seller.update({ where: { id: g.sellerId }, data });
  return NextResponse.json({ ok: true });
}
