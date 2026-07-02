import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 협력점 "이달의 혜택" 관리 API.
 *   GET    — 현재 협력점의 모든 혜택 (order 순)
 *   POST   — 새 혜택 생성. 최대 3장까지만 허용 (컨슈머 UI 3장 슬롯)
 *   PATCH  — 부분 수정 (id 필수)
 *   DELETE — 삭제 (?id=xxx)
 */

const MAX_BENEFITS = 3;

type BenefitPayload = {
  title?: string;
  description?: string;
  iconEmoji?: string;
  linkHref?: string;
  order?: number;
  enabled?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

function parseDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET() {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });

  const benefits = await prisma.partnerBenefit.findMany({
    where: { partnerId: eff.partnerId },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json({
    partnerCode: eff.partnerId,
    benefits: benefits.map(b => ({
      id: b.id,
      title: b.title,
      description: b.description,
      iconEmoji: b.iconEmoji,
      linkHref: b.linkHref,
      order: b.order,
      enabled: b.enabled,
      startsAt: b.startsAt?.toISOString() ?? null,
      endsAt: b.endsAt?.toISOString() ?? null,
      updatedAt: b.updatedAt.toISOString(),
    })),
    maxBenefits: MAX_BENEFITS,
  });
}

export async function POST(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });

  const existingCount = await prisma.partnerBenefit.count({ where: { partnerId: eff.partnerId } });
  if (existingCount >= MAX_BENEFITS) {
    return NextResponse.json({ error: `최대 ${MAX_BENEFITS}장까지 등록 가능합니다. 기존 항목을 삭제하고 추가하세요.` }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as BenefitPayload | null;
  if (!body?.title?.trim()) return NextResponse.json({ error: "title 필수" }, { status: 400 });

  const created = await prisma.partnerBenefit.create({
    data: {
      partnerId: eff.partnerId,
      title: body.title.trim(),
      description: body.description?.trim() ?? "",
      iconEmoji: body.iconEmoji?.trim() || "🎁",
      linkHref: body.linkHref?.trim() ?? "",
      order: body.order ?? existingCount,
      enabled: body.enabled ?? true,
      startsAt: parseDate(body.startsAt) ?? null,
      endsAt: parseDate(body.endsAt) ?? null,
    },
  });
  return NextResponse.json(serialize(created));
}

export async function PATCH(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });

  const body = (await req.json().catch(() => null)) as (BenefitPayload & { id?: string }) | null;
  if (!body?.id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const existing = await prisma.partnerBenefit.findUnique({ where: { id: body.id } });
  if (!existing || existing.partnerId !== eff.partnerId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description.trim();
  if (body.iconEmoji !== undefined) data.iconEmoji = body.iconEmoji.trim() || "🎁";
  if (body.linkHref !== undefined) data.linkHref = body.linkHref.trim();
  if (body.order !== undefined) data.order = body.order;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  const sd = parseDate(body.startsAt); if (sd !== undefined) data.startsAt = sd;
  const ed = parseDate(body.endsAt); if (ed !== undefined) data.endsAt = ed;

  const updated = await prisma.partnerBenefit.update({ where: { id: body.id }, data });
  return NextResponse.json(serialize(updated));
}

export async function DELETE(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const existing = await prisma.partnerBenefit.findUnique({ where: { id } });
  if (!existing || existing.partnerId !== eff.partnerId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.partnerBenefit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

function serialize(b: { id: string; title: string; description: string; iconEmoji: string; linkHref: string; order: number; enabled: boolean; startsAt: Date | null; endsAt: Date | null; updatedAt: Date }) {
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    iconEmoji: b.iconEmoji,
    linkHref: b.linkHref,
    order: b.order,
    enabled: b.enabled,
    startsAt: b.startsAt?.toISOString() ?? null,
    endsAt: b.endsAt?.toISOString() ?? null,
    updatedAt: b.updatedAt.toISOString(),
  };
}
