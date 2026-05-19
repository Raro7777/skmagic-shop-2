import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { notifyHq, esc } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ApprovalRequest.body 에서 분양 신청 시 저장된 정보 파싱 (apply route 의 인코딩과 짝)
function parseApplicationBody(body: string | null) {
  const out: { region?: string; phone?: string; brands?: string; teamSize?: string; plan?: string; memo?: string; email?: string } = {};
  if (!body) return out;
  for (const part of body.split(" · ")) {
    const m = part.match(/^([^:]+):\s*(.+)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "지역") out.region = v;
    else if (k === "관심 브랜드") out.brands = v;
    else if (k === "영업조직") out.teamSize = v;
    else if (k === "희망 패키지") out.plan = v;
    else if (k === "문의/메모") out.memo = v;
    else if (k === "연락처") out.phone = v;
    else if (k === "이메일") out.email = v;
  }
  return out;
}

// reason="applicant=XXX" → 신청자 이름
function parseApplicant(reason: string | null): string | null {
  if (!reason) return null;
  const m = reason.match(/applicant=(.+)/);
  return m ? m[1].trim() : null;
}

// partnerCode 자동 생성 — partner-{6자 hex} 형식. 충돌 시 재시도.
async function generatePartnerCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const candidate = "partner-" + randomBytes(3).toString("hex");
    const exists = await prisma.partner.findUnique({ where: { partnerCode: candidate }, select: { partnerCode: true } });
    if (!exists) return candidate;
  }
  throw new Error("partnerCode 생성 실패 (재시도 한도 초과)");
}

// 임시 비밀번호 — 8자 base32 (혼동 방지: O/0/I/1 제외)
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// PATCH — HQ approves/rejects/resolves an approval request, applies side effects.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{ action: "approve" | "reject" | "resolve"; note: string }>;
  if (!b.action || !["approve", "reject", "resolve"].includes(b.action)) {
    return NextResponse.json({ error: "유효하지 않은 action" }, { status: 400 });
  }

  const appr = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!appr) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  if (appr.status !== "pending") {
    return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 400 });
  }

  const newStatus = b.action === "approve" ? "approved" : b.action === "reject" ? "rejected" : "resolved";
  const reviewNote = b.note?.slice(0, 256) ?? null;

  // Apply side effects within a transaction
  const result = await prisma.$transaction(async tx => {
    // Update the approval first
    const updated = await tx.approvalRequest.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    let sideEffect: string | null = null;

    // Side effects depend on kind + action
    if (newStatus === "approved" && appr.kind === "commission_increase" && appr.productCode) {
      const product = await tx.product.findUnique({
        where: { productCode: appr.productCode },
        include: { hqPolicies: true },
      });
      // commission_increase 승인은 상품의 모든 옵션에 일괄 적용 (대상 옵션 지정이 없으므로).
      if (product && product.hqPolicies.length > 0) {
        await tx.hqPolicy.updateMany({
          where: { productId: product.id },
          data: {
            ...(appr.proposedBaseCommission != null && { baseCommission: appr.proposedBaseCommission }),
            ...(appr.proposedMonthIncentive != null && { monthIncentive: appr.proposedMonthIncentive }),
          },
        });
        sideEffect = `HqPolicy 갱신 (${appr.productCode}, ${product.hqPolicies.length}개 옵션)`;
      } else {
        sideEffect = "Product/HqPolicy 미존재 — HqPolicy 갱신 건너뜀";
      }
    }

    if (newStatus === "approved" && appr.kind === "partner_signup") {
      // 신규 협력점 생성 — Partner row + partner_admin User 동시 발급
      // 우선순위: applicationData (구조화) → body 텍스트 파싱 fallback
      const appData = (appr.applicationData ?? null) as null | {
        applicantName?: string;
        storeName?: string;
        phone?: string;
        email?: string | null;
        region?: string | null;
        address?: string | null;
        businessNumber?: string | null;
        commerceNumber?: string | null;
        hotlineNumber?: string | null;
        brandsOfInterest?: string | null;
        teamSize?: string | null;
        plan?: string | null;
        memo?: string | null;
      };
      const parsed = parseApplicationBody(appr.body);

      const applicantName = appData?.applicantName?.trim() || parseApplicant(appr.reason);
      const storeName = appData?.storeName?.trim() || appr.title;
      const phone = appData?.phone?.trim() || parsed.phone || null;
      const region = appData?.region?.trim() || parsed.region || null;
      const email = appData?.email?.trim() || appr.requestedByEmail?.trim() || parsed.email || null;
      const address = appData?.address?.trim() || null;
      const businessNumber = appData?.businessNumber?.trim() || null;
      const commerceNumber = appData?.commerceNumber?.trim() || null;
      const hotlineNumber = appData?.hotlineNumber?.trim() || null;

      const partnerCode = await generatePartnerCode();

      // 로그인 이메일: 신청자 이메일 우선, 없으면 partnerCode 기반 fallback
      const loginEmail = email?.toLowerCase() || `${partnerCode}@rentking.kr`;
      const emailTaken = await tx.user.findUnique({ where: { email: loginEmail }, select: { id: true } });
      const finalEmail = emailTaken ? `${partnerCode}@rentking.kr` : loginEmail;

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await tx.partner.create({
        data: {
          partnerCode,
          partnerName: storeName.slice(0, 80),
          region,
          phone,
          ownerName: applicantName,
          address,
          businessNumber,
          commerceNumber,
          // 협력점 자체 hotline 입력 시 그 값으로, 없으면 schema default(본사 1600-2434).
          // 컨슈머 footer 는 본사 default 와 같으면 "고객센터" 행 숨김 처리.
          ...(hotlineNumber && { hotlineNumber }),
          status: "active",
          tier: "basic",
        },
      });

      await tx.user.create({
        data: {
          email: finalEmail,
          passwordHash,
          name: applicantName ?? storeName,
          role: "partner_admin",
          partnerId: partnerCode,
        },
      });

      await tx.approvalRequest.update({
        where: { id },
        data: { partnerId: partnerCode },
      });

      sideEffect = `협력점 생성 완료 · partnerCode=${partnerCode} · 신청자=${applicantName ?? "—"} · 지역=${region ?? "—"} · 전화=${phone ?? "—"} · 로그인 ${finalEmail} · 임시 비밀번호 ${tempPassword} · 매장 /p/${partnerCode}`;
    }

    if (newStatus === "resolved" && appr.kind === "settlement_dispute" && appr.settlementId) {
      const s = await tx.settlement.findUnique({ where: { id: appr.settlementId } });
      if (s) {
        await tx.settlement.update({
          where: { id: appr.settlementId },
          data: { status: "confirmed" },
        });
        sideEffect = `Settlement ${appr.settlementId} → confirmed`;
      }
    }

    return { updated, sideEffect };
  });

  // 본사 텔레그램 알림 — 분양 승인 처리 결과 기록 (fire-and-forget).
  // partner_signup 외 다른 kind 도 결과만 짧게 통지.
  const tag = appr.kind === "partner_signup"
    ? "🏪 분양 신청"
    : appr.kind === "commission_increase"
      ? "💰 수수료 인상"
      : appr.kind === "settlement_dispute"
        ? "💳 정산 이의"
        : "📋 결재";
  const decision = newStatus === "approved"
    ? "✅ 승인 완료"
    : newStatus === "rejected"
      ? "❌ 반려"
      : "✓ 처리 완료";
  notifyHq(
    `${tag} — ${decision}\n` +
      `제목: ${esc(appr.title)}\n` +
      (reviewNote ? `검토 메모: ${esc(reviewNote)}\n` : "") +
      (result.sideEffect ? `\n${esc(result.sideEffect)}` : ""),
  );

  return NextResponse.json({
    ok: true,
    approval: {
      id: result.updated.id,
      status: result.updated.status,
      reviewedAt: result.updated.reviewedAt?.toISOString() ?? null,
    },
    sideEffect: result.sideEffect,
  });
}
