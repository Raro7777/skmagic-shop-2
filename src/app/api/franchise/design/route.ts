import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";
import { THEME_PRESETS } from "@/lib/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_THEME_IDS = new Set(THEME_PRESETS.map(t => t.id));
const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

// GET — 현재 적용된 테마 + 롤백 가능 여부
export async function GET() {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const partner = await prisma.partner.findUnique({
    where: { partnerCode: eff.partnerId },
    select: { theme: true, previousTheme: true, themeChangedAt: true },
  });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const canRollback =
    !!partner.previousTheme &&
    !!partner.themeChangedAt &&
    Date.now() - partner.themeChangedAt.getTime() < ROLLBACK_WINDOW_MS;

  return NextResponse.json({
    theme: partner.theme,
    previousTheme: partner.previousTheme,
    themeChangedAt: partner.themeChangedAt?.toISOString() ?? null,
    canRollback,
    rollbackExpiresAt: partner.themeChangedAt
      ? new Date(partner.themeChangedAt.getTime() + ROLLBACK_WINDOW_MS).toISOString()
      : null,
  });
}

// PATCH — 새 테마 적용. body: { theme: "<id>" } 또는 { action: "rollback" }
export async function PATCH(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as { theme?: string; action?: string };

  const current = await prisma.partner.findUnique({
    where: { partnerCode: eff.partnerId },
    select: { theme: true, previousTheme: true, themeChangedAt: true },
  });
  if (!current) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  let nextTheme: string;
  let nextPrevious: string | null;

  if (b.action === "rollback") {
    if (!current.previousTheme || !current.themeChangedAt) {
      return NextResponse.json({ error: "롤백할 이전 테마가 없습니다." }, { status: 400 });
    }
    if (Date.now() - current.themeChangedAt.getTime() >= ROLLBACK_WINDOW_MS) {
      return NextResponse.json({ error: "롤백 가능 시간(24시간)이 지났습니다." }, { status: 400 });
    }
    nextTheme = current.previousTheme;
    nextPrevious = null; // 롤백 후엔 추가 롤백 불가 (왕복 방지)
  } else {
    if (!b.theme || !VALID_THEME_IDS.has(b.theme)) {
      return NextResponse.json({ error: "지원하지 않는 테마 ID 입니다." }, { status: 400 });
    }
    if (b.theme === current.theme) {
      return NextResponse.json({ ok: true, theme: current.theme, unchanged: true });
    }
    nextTheme = b.theme;
    nextPrevious = current.theme;
  }

  await prisma.partner.update({
    where: { partnerCode: eff.partnerId },
    data: {
      theme: nextTheme,
      previousTheme: nextPrevious,
      themeChangedAt: new Date(),
    },
  });

  // 컨슈머 사이트 캐시 무효화 (해당 협력점의 모든 라우트)
  revalidatePath(`/p/${eff.partnerId}`, "layout");

  return NextResponse.json({ ok: true, theme: nextTheme });
}
