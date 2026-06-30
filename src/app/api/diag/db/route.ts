import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 일회용 진단 — DB 연결 + endpoint 호스트 + promotion 카운트 확인
export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  const endpoint = (url.match(/@([^/]+)/)?.[1]) ?? "(no match)";

  let promotionCount = -1;
  let leadCount = -1;
  let error: string | null = null;
  try {
    promotionCount = await prisma.partnerProductPromotion.count();
    leadCount = await prisma.lead.count();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    endpoint,
    urlLength: url.length,
    region: url.includes("us-east-1") ? "us-east-1 (1번)" : url.includes("ap-southeast-1") ? "ap-southeast-1 (2번)" : "unknown",
    promotionCount,
    leadCount,
    error,
  });
}
