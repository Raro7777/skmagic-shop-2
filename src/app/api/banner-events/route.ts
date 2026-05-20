/**
 * POST /api/banner-events — 컨슈머가 보낸 배너 노출/클릭 이벤트 수집.
 * 인증 없음 (public). 본사·협력점만 통계 조회 가능.
 *   body: { bannerId, eventType: "impression"|"click" }
 *
 * viewerPartnerId — 컨슈머가 보고 있는 협력점 사이트의 partnerCode 를
 * Referer 또는 host(customDomain) 에서 server-derive. global 배너 효과를
 * 협력점별로 분리 분석.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = ["impression", "click"] as const;

async function deriveViewerPartner(req: Request): Promise<string | null> {
  // Referer path 우선
  const referer = req.headers.get("referer") ?? "";
  try {
    const u = new URL(referer);
    const m = u.pathname.match(/^\/p\/([a-z0-9-]+)(?:\/|$)/i);
    if (m) return m[1];
  } catch { /* invalid referer */ }

  // customDomain host
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();
  if (host) {
    const p = await prisma.partner.findFirst({
      where: { customDomain: host, customDomainStatus: "verified", status: "active" },
      select: { partnerCode: true },
    });
    if (p) return p.partnerCode;
  }
  return null;
}

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
  const viewerPartnerId = await deriveViewerPartner(req);

  try {
    await prisma.bannerEvent.create({
      data: {
        bannerId: banner.id,
        partnerId: banner.partnerId,
        viewerPartnerId,
        eventType: b.eventType,
        ip,
        userAgent,
      },
    });
  } catch { /* 분석 실패가 사용자 흐름 방해 X */ }

  return NextResponse.json({ ok: true });
}
