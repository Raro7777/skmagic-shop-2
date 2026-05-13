import { NextResponse } from "next/server";
import { getLandingStats } from "@/lib/landingStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 랜딩 페이지 실시간 피드 — 30초 폴링용
export async function GET() {
  const s = await getLandingStats();
  return NextResponse.json({ feed: s.feed });
}
