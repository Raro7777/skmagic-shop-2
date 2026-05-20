/**
 * POST /api/franchise/global-banners/[id]/visibility
 *
 * 협력점이 본인 컨슈머 사이트에서 본사 공통 배너를 숨김(hide) / 다시 노출(unhide).
 * 상태는 Partner.displayConfig.hiddenGlobalBannerIds (string[]) JSON 에 저장.
 * 본사 배너 자체는 그대로 — 협력점별 opt-out 만.
 *
 * Body: { hidden: boolean }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const hidden = !!(body as { hidden?: boolean }).hidden;

  // global 배너인지 확인 (id 유효성)
  const banner = await prisma.banner.findUnique({ where: { id }, select: { id: true, scope: true } });
  if (!banner || banner.scope !== "global") {
    return NextResponse.json({ error: "Not a global banner" }, { status: 404 });
  }

  const partner = await prisma.partner.findUnique({
    where: { partnerCode: eff.partnerId },
    select: { displayConfig: true },
  });
  const current = ((partner?.displayConfig as { hiddenGlobalBannerIds?: string[] } | null)?.hiddenGlobalBannerIds ?? [])
    .filter((x): x is string => typeof x === "string");
  const set = new Set(current);
  if (hidden) set.add(id);
  else set.delete(id);
  const nextHidden = Array.from(set);

  const cfg = (partner?.displayConfig as Record<string, unknown> | null) ?? {};
  const nextCfg = { ...cfg, hiddenGlobalBannerIds: nextHidden };

  await prisma.partner.update({
    where: { partnerCode: eff.partnerId },
    data: { displayConfig: nextCfg },
  });

  return NextResponse.json({ ok: true, hidden, hiddenGlobalBannerIds: nextHidden });
}
