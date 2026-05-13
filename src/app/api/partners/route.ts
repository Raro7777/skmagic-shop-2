/**
 * GET /api/partners — 본사 콘솔용 active 협력점 목록 (간단).
 * (각 협력점 상세는 별도 endpoint 사용)
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") === "1";

  const partners = await prisma.partner.findMany({
    where: activeOnly ? { status: "active" } : undefined,
    orderBy: { partnerName: "asc" },
    select: { partnerCode: true, partnerName: true, status: true, brandLabel: true, region: true },
  });

  return NextResponse.json({ partners });
}
