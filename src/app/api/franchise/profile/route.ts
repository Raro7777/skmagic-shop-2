import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH — 협력점 자기 회사 정보 편집.
 *
 * 자율 편집 (협력점이 직접 변경):
 *   - brandLabel       브랜드 라벨 (헤더 서브 텍스트)
 *   - region           지역 (예: "서울 강남구")
 *   - address          주소
 *   - ownerName        대표자명
 *   - hotlineNumber    고객센터 번호
 *   - phone            협력점 연락처
 *   - kakaoChannelUrl  카카오톡 채널 URL
 *
 * 본사 승인 필요 (이 endpoint로는 변경 불가, 본사 콘솔에서 수정):
 *   - partnerName       상호
 *   - businessNumber    사업자등록번호
 *   - commerceNumber    통신판매번호
 *   - tier              패키지 등급
 *   - status            활성/퇴점 상태
 */
export async function PATCH(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json(
      { error: eff.error === "unauthorized" ? "Unauthorized" : "Forbidden — 협력점 관리자 또는 본사만" },
      { status: eff.error === "unauthorized" ? 401 : 403 },
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Partial<{
    brandLabel: string;
    region: string | null;
    address: string | null;
    ownerName: string | null;
    hotlineNumber: string;
    phone: string | null;
    kakaoChannelUrl: string | null;
    rentalSupportAmount: number;
    businessNumber: string | null;
    commerceNumber: string | null;
    sellerMarginType: "fixed" | "percent";
    sellerMarginAmount: number;
    sellerMarginPercent: number;
    rentalSupportEnabled: boolean;
  }>;

  const data: Parameters<typeof prisma.partner.update>[0]["data"] = {};

  if (b.brandLabel !== undefined) {
    const t = b.brandLabel.trim();
    if (!t) return NextResponse.json({ error: "브랜드 라벨은 비울 수 없습니다." }, { status: 400 });
    data.brandLabel = t.slice(0, 60);
  }
  if (b.region !== undefined) data.region = b.region?.trim().slice(0, 60) || null;
  if (b.address !== undefined) data.address = b.address?.trim().slice(0, 200) || null;
  if (b.ownerName !== undefined) data.ownerName = b.ownerName?.trim().slice(0, 40) || null;
  if (b.hotlineNumber !== undefined) {
    const t = b.hotlineNumber.trim();
    if (!t) return NextResponse.json({ error: "고객센터 번호는 비울 수 없습니다." }, { status: 400 });
    // 숫자·하이픈·괄호·공백·플러스만 허용
    if (!/^[\d\-+\s()]+$/.test(t)) {
      return NextResponse.json({ error: "고객센터 번호 형식 오류 (숫자·하이픈만)" }, { status: 400 });
    }
    data.hotlineNumber = t.slice(0, 24);
  }
  if (b.phone !== undefined) {
    const t = b.phone?.trim() ?? "";
    if (t && !/^[\d\-+\s()]+$/.test(t)) {
      return NextResponse.json({ error: "연락처 형식 오류" }, { status: 400 });
    }
    data.phone = t || null;
  }
  if (b.businessNumber !== undefined) {
    const t = b.businessNumber?.trim() ?? "";
    if (t && !/^[\d\-\s]{8,20}$/.test(t)) {
      return NextResponse.json({ error: "사업자등록번호 형식 오류 (숫자·하이픈)" }, { status: 400 });
    }
    data.businessNumber = t || null;
  }
  if (b.commerceNumber !== undefined) {
    const t = b.commerceNumber?.trim() ?? "";
    if (t && t.length > 40) {
      return NextResponse.json({ error: "통신판매업 신고번호가 너무 깁니다." }, { status: 400 });
    }
    data.commerceNumber = t || null;
  }
  if (b.rentalSupportAmount !== undefined) {
    const raw = Math.floor(Number(b.rentalSupportAmount));
    if (!Number.isFinite(raw) || raw < 0) {
      return NextResponse.json({ error: "렌탈지원금은 0 이상 정수여야 합니다." }, { status: 400 });
    }
    if (raw > 10_000_000) {
      return NextResponse.json({ error: "렌탈지원금이 너무 큽니다 (≤ 10,000,000원)." }, { status: 400 });
    }
    // 만원 단위 절사 — UI에서 이미 미리 알려주지만 API 레벨에서도 강제
    data.rentalSupportAmount = Math.floor(raw / 10000) * 10000;
  }
  if (b.sellerMarginType !== undefined) {
    if (b.sellerMarginType !== "fixed" && b.sellerMarginType !== "percent") {
      return NextResponse.json({ error: "sellerMarginType 은 fixed 또는 percent" }, { status: 400 });
    }
    data.sellerMarginType = b.sellerMarginType;
  }
  if (b.sellerMarginAmount !== undefined) {
    const n = Math.floor(Number(b.sellerMarginAmount));
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "영업자 마진(금액) 은 0 이상 정수여야 합니다." }, { status: 400 });
    }
    data.sellerMarginAmount = n;
  }
  if (b.rentalSupportEnabled !== undefined) {
    data.rentalSupportEnabled = !!b.rentalSupportEnabled;
  }
  if (b.sellerMarginPercent !== undefined) {
    const n = Number(b.sellerMarginPercent);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      return NextResponse.json({ error: "영업자 마진(비율) 은 0~1 범위여야 합니다." }, { status: 400 });
    }
    data.sellerMarginPercent = n;
  }
  if (b.kakaoChannelUrl !== undefined) {
    if (!b.kakaoChannelUrl || b.kakaoChannelUrl.trim() === "") {
      data.kakaoChannelUrl = null;
    } else {
      const trimmed = b.kakaoChannelUrl.trim();
      if (!/^https?:\/\//.test(trimmed)) {
        return NextResponse.json(
          { error: "카카오 채널 URL은 http:// 또는 https://로 시작해야 합니다." },
          { status: 400 },
        );
      }
      data.kakaoChannelUrl = trimmed.slice(0, 512);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경된 필드가 없습니다." }, { status: 400 });
  }

  const updated = await prisma.partner.update({
    where: { partnerCode: eff.partnerId },
    data,
    select: {
      partnerCode: true, partnerName: true, brandLabel: true, region: true, address: true,
      ownerName: true, hotlineNumber: true, phone: true, kakaoChannelUrl: true,
      businessNumber: true, commerceNumber: true, rentalSupportAmount: true,
      sellerMarginType: true, sellerMarginAmount: true, sellerMarginPercent: true,
    },
  });
  return NextResponse.json({ ok: true, partner: updated });
}
