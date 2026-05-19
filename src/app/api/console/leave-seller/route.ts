/**
 * POST /api/console/leave-seller — 영업자 콘솔 임시 진입 cookie 제거.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { SELLER_VIEW_COOKIE } from "@/lib/effectiveSeller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await cookies();
  c.delete(SELLER_VIEW_COOKIE);
  // 진입 전 시점에 보던 화면 — 협력점 콘솔 sellers 페이지가 가장 자연스러움
  const redirect = session.user.role === "hq" ? "/admin/super/partners" : "/admin/franchise/sellers";
  return NextResponse.json({ ok: true, redirect });
}
