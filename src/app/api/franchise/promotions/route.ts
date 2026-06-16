import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 협력점 프로모션 뱃지 관리 API.
 *
 *   GET    — 현재 협력점의 모든 promotion + 선택 가능한 active product 목록
 *   POST   — 새 promotion 생성 또는 (partnerId+productCode) 기준 upsert
 *   PATCH  — 부분 수정 (id 필수)
 *   DELETE — 삭제 (?id=xxx)
 */

type PromotionPayload = {
  productCode?: string;
  enabled?: boolean;
  badgeText?: string;
  startsAt?: string | null;
  endsAt?: string | null;
};

function parseDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined; // 미수정
  if (v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET() {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const [promotions, products] = await Promise.all([
    prisma.partnerProductPromotion.findMany({
      where: { partnerId: eff.partnerId },
      orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.product.findMany({
      where: { status: "active" },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { productCode: true, name: true, modelName: true, category: true },
    }),
  ]);

  return NextResponse.json({
    partnerCode: eff.partnerId,
    promotions: promotions.map(p => ({
      id: p.id,
      productCode: p.productCode,
      enabled: p.enabled,
      badgeText: p.badgeText,
      startsAt: p.startsAt?.toISOString() ?? null,
      endsAt: p.endsAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
    })),
    products,
  });
}

export async function POST(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const body = (await req.json().catch(() => null)) as PromotionPayload | null;
  if (!body?.productCode || typeof body.badgeText !== "string") {
    return NextResponse.json({ error: "productCode + badgeText 필수" }, { status: 400 });
  }

  // 동일 productCode 존재 시 update (upsert) — UI 가 행 단위로 관리하기 편하게
  const startsAt = parseDate(body.startsAt) ?? null;
  const endsAt = parseDate(body.endsAt) ?? null;

  const saved = await prisma.partnerProductPromotion.upsert({
    where: {
      partnerId_productCode: {
        partnerId: eff.partnerId,
        productCode: body.productCode,
      },
    },
    create: {
      partnerId: eff.partnerId,
      productCode: body.productCode,
      enabled: body.enabled ?? true,
      badgeText: body.badgeText,
      startsAt,
      endsAt,
    },
    update: {
      enabled: body.enabled ?? true,
      badgeText: body.badgeText,
      startsAt,
      endsAt,
    },
  });

  return NextResponse.json({
    id: saved.id,
    productCode: saved.productCode,
    enabled: saved.enabled,
    badgeText: saved.badgeText,
    startsAt: saved.startsAt?.toISOString() ?? null,
    endsAt: saved.endsAt?.toISOString() ?? null,
    updatedAt: saved.updatedAt.toISOString(),
  });
}

export async function PATCH(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const body = (await req.json().catch(() => null)) as (PromotionPayload & { id?: string }) | null;
  if (!body?.id) {
    return NextResponse.json({ error: "id 필수" }, { status: 400 });
  }

  // 소유권 확인
  const existing = await prisma.partnerProductPromotion.findUnique({ where: { id: body.id } });
  if (!existing || existing.partnerId !== eff.partnerId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.badgeText !== undefined) data.badgeText = body.badgeText;
  const sd = parseDate(body.startsAt);
  if (sd !== undefined) data.startsAt = sd;
  const ed = parseDate(body.endsAt);
  if (ed !== undefined) data.endsAt = ed;

  const updated = await prisma.partnerProductPromotion.update({
    where: { id: body.id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    productCode: updated.productCode,
    enabled: updated.enabled,
    badgeText: updated.badgeText,
    startsAt: updated.startsAt?.toISOString() ?? null,
    endsAt: updated.endsAt?.toISOString() ?? null,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const existing = await prisma.partnerProductPromotion.findUnique({ where: { id } });
  if (!existing || existing.partnerId !== eff.partnerId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.partnerProductPromotion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
