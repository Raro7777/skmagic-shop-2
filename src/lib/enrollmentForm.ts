/**
 * EnrollmentForm 도메인 — 가입 신청서 작성/조회/마스킹 + 권한 매트릭스.
 *
 * 룰:
 *   - consult_active → form_ready 전이는 EnrollmentForm 존재 필요 (leadStore 가드)
 *   - install_pending 진입 시 lockedAt 자동 설정 (leadStore 가드)
 *   - PII 평문 저장. 권한별 마스킹은 viewForRole 사용.
 */
import { prisma } from "./prisma";
import type { ActorRole } from "./leadStatus";

export type PaymentDayType = "month_end" | "day_10" | "day_15" | "day_20" | "day_25" | "weekly_friday" | "custom";

export const PAYMENT_DAY_LABEL: Record<PaymentDayType, string> = {
  month_end:     "익월 말일",
  day_10:        "매월 10일",
  day_15:        "매월 15일",
  day_20:        "매월 20일",
  day_25:        "매월 25일",
  weekly_friday: "익주 금요일",
  custom:        "직접 입력",
};

export type EnrollmentFormInput = {
  // 고객
  customerName: string;
  residentRegNumber: string;
  email?: string | null;
  phone: string;
  address: string;
  addressDetail?: string | null;
  // 상품/약정
  productCode: string;
  productName: string;
  managementMode?: "방문형" | "셀프형" | null;
  contractPeriod: number;
  visitInterval?: string | null;
  monthlyPrice: number;
  isRivalCompensation?: boolean;
  isHalfPriceMonths?: number | null;
  // 색상/사이즈 변형 (가격에 영향 없음)
  selectedColor?: string | null;
  // 사은품
  giftAmount?: number;
  giftLabel?: string | null;
  // 결제일
  paymentDayType: PaymentDayType;
  paymentDayValue?: string | null;
  // 설치
  installSchedule?: string | null;
  installPreferredDate?: Date | null;
  // 자동이체 / 사은계좌 (사은계좌 null이면 자동이체와 동일로 간주)
  autoDebitBank: string;
  autoDebitAccount: string;
  autoDebitHolder: string;
  giftBank?: string | null;
  giftAccount?: string | null;
  giftHolder?: string | null;
  // 카테고리별 추가
  categorySpecific?: Record<string, unknown> | null;
  memo?: string | null;
};

function validateInput(b: EnrollmentFormInput): string | null {
  if (!b.customerName?.trim()) return "고객 이름 누락";
  if (!/^\d{6}-?\d{7}$/.test(b.residentRegNumber.replace(/[-\s]/g, "").replace(/^(\d{6})(\d{7})$/, "$1-$2"))) {
    // accept "791105-2251224" or "7911052251224"
    return "주민번호 형식 오류 (6자-7자)";
  }
  if (!b.address?.trim()) return "주소 누락";
  if (!b.productCode?.trim()) return "상품 누락";
  if (!Number.isInteger(b.contractPeriod) || b.contractPeriod <= 0) return "약정기간 오류";
  if (!Number.isFinite(b.monthlyPrice) || b.monthlyPrice <= 0) return "월요금 오류";
  if (!b.autoDebitBank?.trim() || !b.autoDebitAccount?.trim() || !b.autoDebitHolder?.trim()) return "자동이체 계좌 정보 누락";
  if (!["month_end","day_10","day_15","day_20","day_25","weekly_friday","custom"].includes(b.paymentDayType)) return "결제일 타입 오류";
  if (b.paymentDayType === "custom" && !b.paymentDayValue?.trim()) return "직접 입력 결제일 누락";
  return null;
}

function normalizeRRN(s: string): string {
  const d = s.replace(/[-\s]/g, "");
  if (d.length === 13) return `${d.slice(0, 6)}-${d.slice(6)}`;
  return s;
}

export async function upsertEnrollmentForm(input: {
  leadId: string;
  data: EnrollmentFormInput;
  actorId: string | null;
  actorRole: ActorRole;
}): Promise<{ ok: true; id: string; isNew: boolean } | { error: string }> {
  const err = validateInput(input.data);
  if (err) return { error: err };

  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true, partnerId: true, sellerId: true, status: true } });
  if (!lead) return { error: "Lead not found" };

  // 잠금 확인
  const existing = await prisma.enrollmentForm.findUnique({ where: { leadId: input.leadId } });
  if (existing?.lockedAt && input.actorRole !== "hq") {
    return { error: "신청서가 잠금 상태입니다 (설치대기 이후). 본사에 잠금 해제를 요청하세요." };
  }

  const d = input.data;
  const payload = {
    customerName: d.customerName.trim().slice(0, 32),
    residentRegNumber: normalizeRRN(d.residentRegNumber),
    email: d.email?.trim() || null,
    phone: d.phone.trim(),
    address: d.address.trim().slice(0, 256),
    addressDetail: d.addressDetail?.trim() || null,
    productCode: d.productCode.trim(),
    productName: d.productName.trim().slice(0, 80),
    managementMode: d.managementMode ?? null,
    contractPeriod: d.contractPeriod,
    visitInterval: d.visitInterval ?? null,
    monthlyPrice: d.monthlyPrice,
    isRivalCompensation: !!d.isRivalCompensation,
    isHalfPriceMonths: d.isHalfPriceMonths ?? null,
    selectedColor: d.selectedColor?.trim().slice(0, 80) || null,
    giftAmount: d.giftAmount ?? 0,
    giftLabel: d.giftLabel ?? null,
    paymentDayType: d.paymentDayType,
    paymentDayValue: d.paymentDayValue ?? null,
    installSchedule: d.installSchedule ?? null,
    installPreferredDate: d.installPreferredDate ?? null,
    autoDebitBank: d.autoDebitBank.trim(),
    autoDebitAccount: d.autoDebitAccount.trim(),
    autoDebitHolder: d.autoDebitHolder.trim(),
    giftBank: d.giftBank?.trim() || null,
    giftAccount: d.giftAccount?.trim() || null,
    giftHolder: d.giftHolder?.trim() || null,
    categorySpecific: (d.categorySpecific ?? null) as never,
    memo: d.memo?.trim() || null,
  };

  if (existing) {
    await prisma.enrollmentForm.update({ where: { id: existing.id }, data: payload });
    return { ok: true, id: existing.id, isNew: false };
  }
  const created = await prisma.enrollmentForm.create({
    data: {
      ...payload,
      leadId: input.leadId,
      createdById: input.actorId,
      createdByRole: input.actorRole,
    },
  });
  return { ok: true, id: created.id, isNew: true };
}

/** install_pending 진입 시 자동 호출 — lockedAt 설정 */
export async function lockEnrollmentForm(leadId: string): Promise<void> {
  await prisma.enrollmentForm.updateMany({
    where: { leadId, lockedAt: null },
    data: { lockedAt: new Date() },
  });
}

/** 본사 잠금 해제 (수정요청 회송 등) */
export async function unlockEnrollmentForm(leadId: string): Promise<void> {
  await prisma.enrollmentForm.updateMany({
    where: { leadId },
    data: { lockedAt: null },
  });
}

/** PII 마스킹 — 권한별 가시성 */
export function maskRRN(rrn: string, role: ActorRole, isOwnRecord: boolean): string {
  if (role === "hq" || role === "partner_admin") return rrn;
  if (role === "seller" && isOwnRecord) return rrn;
  // 다른 영업자가 작성한 건 마스킹
  return rrn.replace(/^(\d{6})-?(\d)\d{6}$/, "$1-$2******");
}

export function maskAccount(acct: string, role: ActorRole, isOwnRecord: boolean): string {
  if (role === "hq" || role === "partner_admin") return acct;
  if (role === "seller" && isOwnRecord) return acct;
  if (acct.length < 6) return acct;
  return acct.slice(0, 4) + "*".repeat(Math.max(0, acct.length - 6)) + acct.slice(-2);
}

/** 단일 신청서를 actorRole 기준 가시 형태로 변환 */
export type EnrollmentView = ReturnType<typeof viewForRole>;
export function viewForRole(
  form: Awaited<ReturnType<typeof prisma.enrollmentForm.findUnique>>,
  ctx: { actorRole: ActorRole; actorId: string | null }
) {
  if (!form) return null;
  const isOwn = !!form.createdById && form.createdById === ctx.actorId;
  return {
    ...form,
    residentRegNumber: maskRRN(form.residentRegNumber, ctx.actorRole, isOwn),
    autoDebitAccount: maskAccount(form.autoDebitAccount, ctx.actorRole, isOwn),
    giftAccount: form.giftAccount ? maskAccount(form.giftAccount, ctx.actorRole, isOwn) : null,
  };
}
