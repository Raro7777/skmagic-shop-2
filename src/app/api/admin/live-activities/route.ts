/**
 * 본사 admin 전용 — 실시간 접수 데모 활동 CRUD.
 * 모든 협력점 사이트 hero 위에 자동 롤링되는 띠배너 데이터.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gateHq() {
  const session = await auth();
  if (!session?.user) return { error: "unauthorized" as const, status: 401 };
  if (session.user.role !== "hq") return { error: "forbidden" as const, status: 403 };
  return { user: session.user };
}

export async function GET() {
  const g = await gateHq();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const items = await prisma.liveActivity.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const g = await gateHq();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const b = body as Partial<{ customerName: string; productName: string; region: string | null; status: string; minutesAgo: number; priority: number; isActive: boolean }>;
  if (!b.customerName?.trim() || !b.productName?.trim()) return NextResponse.json({ error: "customerName, productName 필수" }, { status: 400 });
  const created = await prisma.liveActivity.create({
    data: {
      customerName: b.customerName.trim().slice(0, 40),
      productName: b.productName.trim().slice(0, 80),
      region: b.region?.trim().slice(0, 40) || null,
      status: ["접수완료", "상담대기", "설치완료"].includes(b.status ?? "") ? b.status! : "접수완료",
      minutesAgo: typeof b.minutesAgo === "number" ? Math.max(0, Math.floor(b.minutesAgo)) : 5,
      priority: typeof b.priority === "number" ? Math.max(0, Math.floor(b.priority)) : 0,
      isActive: b.isActive !== false,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
