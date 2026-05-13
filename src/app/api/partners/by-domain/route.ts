/**
 * GET /api/partners/by-domain?host=<host>
 *
 * middleware 에서 host 기반 rewrite 시 호출하는 lookup endpoint.
 * Edge runtime 의 middleware 에서 prisma 직접 불가능해서 분리.
 * 응답 캐시는 짧게 두어 새 도메인 등록 시 빠르게 반영.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = (url.searchParams.get("host") ?? "").trim().toLowerCase();
  if (!host) return NextResponse.json({ error: "host 필수" }, { status: 400 });

  const partner = await prisma.partner.findUnique({
    where: { customDomain: host },
    select: { partnerCode: true, customDomainStatus: true, status: true },
  });

  if (!partner || partner.status !== "active") {
    return NextResponse.json(
      { partnerCode: null },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
    );
  }

  return NextResponse.json(
    {
      partnerCode: partner.partnerCode,
      customDomainStatus: partner.customDomainStatus,
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}
