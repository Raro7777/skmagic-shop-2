/**
 * 협력점 customDomain 등록 / 조회 / 삭제 / 재검증.
 *
 * 권한: hq (모든 협력점) | partner_admin (본인 점만)
 *
 *   POST   /api/partners/[code]/custom-domain   { domain }  — 도메인 등록 + Vercel 등록
 *   GET    /api/partners/[code]/custom-domain                — 현재 도메인 + Vercel 상태 + DNS 안내
 *   DELETE /api/partners/[code]/custom-domain                — 도메인 해제
 *   PUT    /api/partners/[code]/custom-domain                — 상태 재검증 (Vercel 재조회)
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  addProjectDomain,
  removeProjectDomain,
  getDomainStatus,
  normalizeHost,
  isValidHost,
} from "@/lib/vercelDomains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate(code: string) {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = session.user.role;
  if (role === "hq") return { code };
  if (role === "partner_admin" && session.user.partnerId === code) return { code };
  return { err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const g = await gate(code);
  if ("err" in g) return g.err;

  let body: { domain?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const host = normalizeHost(body.domain ?? "");
  if (!host) return NextResponse.json({ error: "domain 필수" }, { status: 400 });
  if (!isValidHost(host)) return NextResponse.json({ error: "유효하지 않은 도메인 형식" }, { status: 400 });

  // 다른 협력점이 이미 사용 중인지 검사
  const existing = await prisma.partner.findUnique({ where: { customDomain: host }, select: { partnerCode: true } });
  if (existing && existing.partnerCode !== code) {
    return NextResponse.json({ error: `이미 다른 협력점(${existing.partnerCode})이 사용 중인 도메인입니다.` }, { status: 409 });
  }

  // Vercel에 도메인 등록
  const vercel = await addProjectDomain(host);
  if ("error" in vercel) return NextResponse.json({ error: vercel.error }, { status: 502 });

  // DB 갱신 — 같은 협력점에 다른 도메인이 등록되어 있었다면 Vercel에서 그것 먼저 제거
  const partner = await prisma.partner.findUnique({ where: { partnerCode: code }, select: { customDomain: true } });
  if (partner?.customDomain && partner.customDomain !== host) {
    await removeProjectDomain(partner.customDomain).catch(() => null);
  }

  // Vercel 상태 즉시 조회
  const status = await getDomainStatus(host);
  const customDomainStatus = status?.verified ? "verified" : status?.misconfigured ? "misconfigured" : "pending";

  await prisma.partner.update({
    where: { partnerCode: code },
    data: { customDomain: host, customDomainStatus, customDomainAddedAt: new Date() },
  });

  return NextResponse.json({ ok: true, domain: host, status: customDomainStatus, verification: status?.verification ?? null });
}

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const g = await gate(code);
  if ("err" in g) return g.err;

  const partner = await prisma.partner.findUnique({
    where: { partnerCode: code },
    select: { customDomain: true, customDomainStatus: true, customDomainAddedAt: true },
  });
  if (!partner?.customDomain) {
    return NextResponse.json({ domain: null, status: null, verification: null });
  }
  const status = await getDomainStatus(partner.customDomain).catch(() => null);
  return NextResponse.json({
    domain: partner.customDomain,
    status: partner.customDomainStatus,
    addedAt: partner.customDomainAddedAt?.toISOString() ?? null,
    verification: status?.verification ?? null,
    vercelVerified: status?.verified ?? false,
    vercelMisconfigured: status?.misconfigured ?? false,
    apexName: status?.apexName ?? null,
  });
}

export async function PUT(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  // 재검증 — Vercel 상태 다시 조회해서 DB 갱신
  const { code } = await ctx.params;
  const g = await gate(code);
  if ("err" in g) return g.err;

  const partner = await prisma.partner.findUnique({ where: { partnerCode: code }, select: { customDomain: true } });
  if (!partner?.customDomain) return NextResponse.json({ error: "도메인이 등록되지 않았습니다." }, { status: 404 });

  const status = await getDomainStatus(partner.customDomain);
  if (!status) return NextResponse.json({ error: "Vercel 상태 조회 실패" }, { status: 502 });

  const customDomainStatus = status.verified ? "verified" : status.misconfigured ? "misconfigured" : "pending";
  await prisma.partner.update({
    where: { partnerCode: code },
    data: { customDomainStatus },
  });
  return NextResponse.json({ ok: true, status: customDomainStatus, verification: status.verification, vercelVerified: status.verified });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const g = await gate(code);
  if ("err" in g) return g.err;

  const partner = await prisma.partner.findUnique({ where: { partnerCode: code }, select: { customDomain: true } });
  if (!partner?.customDomain) return NextResponse.json({ ok: true, message: "해제할 도메인 없음" });

  // Vercel에서 먼저 제거
  await removeProjectDomain(partner.customDomain).catch(() => null);
  await prisma.partner.update({
    where: { partnerCode: code },
    data: { customDomain: null, customDomainStatus: null, customDomainAddedAt: null },
  });
  return NextResponse.json({ ok: true });
}
