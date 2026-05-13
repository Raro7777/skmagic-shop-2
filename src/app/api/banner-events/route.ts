/**
 * POST /api/banner-events — 컨슈머가 보낸 배너 노출/클릭 이벤트 수집.
 * 인증 없음 (public). 본사·협력점만 통계 조회 가능.
 *   body: { bannerId, eventType: "impression"|"click" }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = ["impression", "click"] as const;

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ bannerId: string; eventType: string }>;
  if (!b.bannerId || !b.eventType || !(ALLOWED as readonly string[]).includes(b.eventType)) {
    return NextResponse.json({ error: "bannerId + eventType 필수" }, { status: 400 });
  }

  // 배너 존재 확인 + partnerId 캐싱
  const banner = await prisma.banner.findUnique({
    where: { id: b.bannerId },
    select: { id: true, partnerId: true },
  });
  if (!banner) return NextResponse.json({ ok: true });

  const xff = req.headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip") ?? null);
  const userAgent = req.headers.get("user-agent");

  try {
    await prisma.bannerEvent.create({
      data: {
        bannerId: banner.id,
        partnerId: banner.partnerId,
        eventType: b.eventType,
        ip,
        userAgent,
      },
    });
  } catch { /* 분석 실패가 사용자 흐름 방해 X */ }

  return NextResponse.json({ ok: true });
}
