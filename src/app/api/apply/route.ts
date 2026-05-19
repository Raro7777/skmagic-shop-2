import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyHq, esc } from "@/lib/telegram";

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
    address: string;
    businessNumber: string;
    commerceNumber: string;
    hotlineNumber: string;
    brandsOfInterest: string;
    teamSize: string;
    plan: string;
    memo: string;
  }>;

  if (!b.applicantName?.trim() || !b.storeName?.trim() || !b.phone?.trim() || !b.businessNumber?.trim() || !b.address?.trim()) {
    return NextResponse.json(
      { error: "필수 항목 누락 (이름·상호명·휴대폰·사업자번호·사업장 주소)" },
      { status: 400 }
    );
  }
  const phoneDigits = b.phone.replace(/\D/g, "");
  if (phoneDigits.length !== 11 || !phoneDigits.startsWith("010")) {
    return NextResponse.json({ error: "유효하지 않은 휴대폰 번호" }, { status: 400 });
  }
  const bizDigits = b.businessNumber.replace(/\D/g, "");
  if (bizDigits.length !== 10) {
    return NextResponse.json({ error: "사업자번호는 10자리 숫자여야 합니다" }, { status: 400 });
  }
  // 사업자번호 정규화: 10자리 → "XXX-XX-XXXXX" 표준 표기
  const businessNumberFormatted = `${bizDigits.slice(0, 3)}-${bizDigits.slice(3, 5)}-${bizDigits.slice(5)}`;

  const lines: string[] = [];
  if (b.region) lines.push(`지역: ${b.region}`);
  lines.push(`주소: ${b.address.trim()}`);
  lines.push(`사업자번호: ${businessNumberFormatted}`);
  if (b.commerceNumber?.trim()) lines.push(`통신판매번호: ${b.commerceNumber.trim()}`);
  if (b.hotlineNumber?.trim()) lines.push(`고객센터: ${b.hotlineNumber.trim()}`);
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
    address: b.address.trim(),
    businessNumber: businessNumberFormatted,
    commerceNumber: b.commerceNumber?.trim() || null,
    hotlineNumber: b.hotlineNumber?.trim() || null,
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

  // 본사 텔레그램 알림 — 신규 분양 신청 접수 (fire-and-forget)
  notifyHq(
    `🏪 <b>신규 분양 신청 접수</b>\n` +
      `상호: ${esc(b.storeName.trim())}\n` +
      `신청자: ${esc(b.applicantName.trim())}\n` +
      `휴대폰: ${esc(phoneDigits)}\n` +
      (b.region ? `지역: ${esc(b.region.trim())}\n` : "") +
      `사업자: ${esc(businessNumberFormatted)}\n` +
      `\n본사 슈퍼관리자 → 분양 승인 큐에서 검토 부탁드립니다.`,
  );

  return NextResponse.json({
    ok: true,
    applicationId: created.id,
    message: "분양 신청이 접수됐습니다. 본사 검토 후 1~2 영업일 내 연락드립니다.",
  });
}
