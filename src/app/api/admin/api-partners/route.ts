import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const partners = await prisma.apiPartner.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    partners: partners.map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      // apiKey는 마스킹해서 반환 (목록에서는 평문 노출 X)
      apiKeyMasked: p.apiKey.slice(0, 8) + "..." + p.apiKey.slice(-4),
      status: p.status,
      allowedCategories: p.allowedCategories,
      contactEmail: p.contactEmail,
      webhookUrl: p.webhookUrl,
      totalLeads: p.totalLeads,
      totalProductFetches: p.totalProductFetches,
      lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{
    slug: string;
    name: string;
    allowedCategories: string[];
    contactEmail: string;
    webhookUrl: string;
    notes: string;
  }>;

  if (!b.slug?.trim() || !b.name?.trim()) {
    return NextResponse.json({ error: "slug + name 필수" }, { status: 400 });
  }
  if (!/^[a-z][a-z0-9-]{2,32}$/.test(b.slug)) {
    return NextResponse.json({ error: "slug는 소문자/숫자/하이픈만 (3~32자, 영문 시작)" }, { status: 400 });
  }

  const apiKey = "rk_" + crypto.randomBytes(24).toString("base64url"); // 32+ 자
  const allowedCategories = Array.isArray(b.allowedCategories)
    ? b.allowedCategories.filter(c => typeof c === "string" && /^[a-z]+$/.test(c)).slice(0, 8)
    : [];

  try {
    const created = await prisma.apiPartner.create({
      data: {
        slug: b.slug.trim(),
        name: b.name.trim().slice(0, 80),
        apiKey,
        allowedCategories,
        contactEmail: b.contactEmail?.trim().slice(0, 128) ?? null,
        webhookUrl: b.webhookUrl?.trim().slice(0, 512) ?? null,
        notes: b.notes?.trim().slice(0, 512) ?? null,
        status: "active",
      },
    });
    // 발급 시 1회만 평문 apiKey 응답 — 이후엔 조회 불가
    return NextResponse.json({
      ok: true,
      id: created.id,
      slug: created.slug,
      name: created.name,
      apiKey,                           // ⚠ 1회 노출 — 운영자가 외부 사이트에 등록 후 폐기
      message: "API 키가 발급되었습니다. 외부 사이트에 즉시 등록하시고 이 창을 닫으면 다시 조회할 수 없습니다.",
    });
  } catch (e) {
    const ec = (e as { code?: string }).code;
    if (ec === "P2002") return NextResponse.json({ error: "slug 중복" }, { status: 400 });
    return NextResponse.json({ error: "등록 실패" }, { status: 500 });
  }
}
