import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public endpoint — anyone can apply to become a partner. Result is queued in
// ApprovalRequest with kind="partner_signup" for HQ to review.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Partial<{
    applicantName: string;
    storeName: string;
    phone: string;
    email: string;
    region: string;
    brandsOfInterest: string;
    teamSize: string;
    plan: string;
    memo: string;
  }>;

  if (!b.applicantName?.trim() || !b.storeName?.trim() || !b.phone?.trim()) {
    return NextResponse.json(
      { error: "필수 항목 누락 (이름·상호명·휴대폰)" },
      { status: 400 }
    );
  }
  const phoneDigits = b.phone.replace(/\D/g, "");
  if (phoneDigits.length !== 11 || !phoneDigits.startsWith("010")) {
    return NextResponse.json({ error: "유효하지 않은 휴대폰 번호" }, { status: 400 });
  }

  const lines: string[] = [];
  if (b.region) lines.push(`지역: ${b.region}`);
  if (b.brandsOfInterest) lines.push(`관심 브랜드: ${b.brandsOfInterest}`);
  if (b.teamSize) lines.push(`영업조직: ${b.teamSize}`);
  if (b.plan) lines.push(`희망 패키지: ${b.plan}`);
  if (b.memo) lines.push(`문의/메모: ${b.memo}`);
  lines.push(`연락처: ${phoneDigits}`);
  if (b.email) lines.push(`이메일: ${b.email}`);

  // 신청서 원본 데이터 구조화 보관 — 승인 시 Partner 에 그대로 매핑됨.
  // body 텍스트는 admin 빠른 훑어보기용으로 유지.
  const applicationData: Prisma.InputJsonValue = {
    applicantName: b.applicantName.trim(),
    storeName: b.storeName.trim(),
    phone: phoneDigits,
    email: b.email?.trim() || null,
    region: b.region?.trim() || null,
    brandsOfInterest: b.brandsOfInterest?.trim() || null,
    teamSize: b.teamSize?.trim() || null,
    plan: b.plan?.trim() || null,
    memo: b.memo?.trim() || null,
    submittedAt: new Date().toISOString(),
  };

  const created = await prisma.approvalRequest.create({
    data: {
      kind: "partner_signup",
      title: b.storeName.trim().slice(0, 80),
      body: lines.join(" · ").slice(0, 800),
      applicationData,
      status: "pending",
      partnerId: null,
      requestedByEmail: b.email?.trim() || null,
      reason: `applicant=${b.applicantName.trim().slice(0, 32)}`,
    },
  });

  return NextResponse.json({
    ok: true,
    applicationId: created.id,
    message: "분양 신청이 접수됐습니다. 본사 검토 후 1~2 영업일 내 연락드립니다.",
  });
}
