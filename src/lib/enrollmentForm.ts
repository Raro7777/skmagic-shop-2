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
  // 결제수단 — 자동이체 또는 카드 (둘 중 하나 필수)
  paymentMethod?: "auto_debit" | "card";
  // 자동이체 (paymentMethod=auto_debit)
  autoDebitBank?: string | null;
  autoDebitAccount?: string | null;
  autoDebitHolder?: string | null;
  // 신용카드 (paymentMethod=card)
  cardCompany?: string | null;
  cardNumber?: string | null;
  cardHolder?: string | null;
  cardExpiry?: string | null;
  // 사은계좌 (자동이체와 다를 경우만 입력) — null 이면 자동이체와 동일
  giftBank?: string | null;
  giftAccount?: string | null;
  giftHolder?: string | null;
  // 사은품 지급처 ("본사" | "협력점") + 협력점 직접 지급 시 현금 금액
  giftPaidBy?: string | null;
  giftCashAmount?: number | null;
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
  const method = b.paymentMethod ?? "auto_debit";
  if (method === "auto_debit") {
    if (!b.autoDebitBank?.trim() || !b.autoDebitAccount?.trim() || !b.autoDebitHolder?.trim()) return "자동이체 계좌 정보 누락";
  } else if (method === "card") {
    if (!b.cardCompany?.trim() || !b.cardNumber?.trim() || !b.cardHolder?.trim() || !b.cardExpiry?.trim()) return "카드 정보 누락";
    if (!/^\d{2}\/?\d{2}$/.test(b.cardExpiry.replace(/[\s-]/g, ""))) return "카드 유효기간 형식 오류 (MM/YY)";
  } else {
    return "결제수단 선택 오류";
  }
  if (!["month_end","day_10","day_15","day_20","day_25","weekly_friday","custom"].includes(b.paymentDayType)) return "결제일 타입 오류";
  if (b.paymentDayType === "custom" && !b.paymentDayValue?.trim()) return "직접 입력 결제일 누락";
  return null;
}

function normalizeRRN(s: string): string {
  const d = s.replace(/[-\s]/g, "");
  if (d.length === 13) return `${d.slice(0, 6)}-${d.slice(6)}`;
  return s;
}

export type ChangeSource = "initial_create" | "customer_request" | "internal_correction" | "hq_revision_response" | "system";

// 신청서 변경 이력에 기록할 핵심 필드 화이트리스트. PII 변경도 추적 (계좌·주민번호 변경은 분쟁 핵심).
const TRACKED_FIELDS = [
  "customerName", "residentRegNumber", "email", "phone", "address", "addressDetail",
  "productCode", "productName", "managementMode", "contractPeriod", "visitInterval",
  "monthlyPrice", "isRivalCompensation", "isHalfPriceMonths", "selectedColor",
  "giftAmount", "giftLabel",
  "paymentDayType", "paymentDayValue",
  "installSchedule", "installPreferredDate",
  "paymentMethod",
  "autoDebitBank", "autoDebitAccount", "autoDebitHolder",
  "cardCompany", "cardNumber", "cardHolder", "cardExpiry",
  "giftBank", "giftAccount", "giftHolder",
  "giftPaidBy", "giftCashAmount",
  "memo",
] as const;

function diffPayload(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  if (!before) return {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of TRACKED_FIELDS) {
    const a = before[k];
    const b = after[k];
    // Date 비교는 ISO 문자열로
    const aNorm = a instanceof Date ? a.toISOString() : a;
    const bNorm = b instanceof Date ? b.toISOString() : b;
    if (aNorm !== bNorm) changes[k] = { from: a ?? null, to: b ?? null };
  }
  return changes;
}

export async function upsertEnrollmentForm(input: {
  leadId: string;
  data: EnrollmentFormInput;
  actorId: string | null;
  actorRole: ActorRole;
  /** 변경 사유 (수정 시 필수 권장) */
  changeReason?: string | null;
  /** 변경 출처 — UI 가 명시. 신규 생성 시 자동 "initial_create" */
  changeSource?: ChangeSource;
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
  const method: "auto_debit" | "card" = d.paymentMethod ?? "auto_debit";
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
    paymentMethod: method,
    autoDebitBank: method === "auto_debit" ? (d.autoDebitBank?.trim() ?? null) : null,
    autoDebitAccount: method === "auto_debit" ? (d.autoDebitAccount?.trim() ?? null) : null,
    autoDebitHolder: method === "auto_debit" ? (d.autoDebitHolder?.trim() ?? null) : null,
    cardCompany: method === "card" ? (d.cardCompany?.trim() ?? null) : null,
    cardNumber: method === "card" ? (d.cardNumber?.replace(/\s|-/g, "").trim() ?? null) : null,
    cardHolder: method === "card" ? (d.cardHolder?.trim() ?? null) : null,
    cardExpiry: method === "card" ? (d.cardExpiry?.replace(/\s|-/g, "").trim() ?? null) : null,
    giftBank: d.giftBank?.trim() || null,
    giftAccount: d.giftAccount?.trim() || null,
    giftHolder: d.giftHolder?.trim() || null,
    giftPaidBy: d.giftPaidBy?.trim() || null,
    giftCashAmount: typeof d.giftCashAmount === "number" && d.giftCashAmount > 0
      ? Math.floor(d.giftCashAmount)
      : null,
    categorySpecific: (d.categorySpecific ?? null) as never,
    memo: d.memo?.trim() || null,
  };

  // Lead 동기화 — 신청서가 본사·정산 화면과 일관성 유지하려면 반드시 성공해야 함.
  // 실패 시 explicit error 반환 (silently 무시하지 않음).
  try {
    await prisma.lead.update({
      where: { id: input.leadId },
      data: {
        customerName: payload.customerName,
        productCode: payload.productCode,
        productInterest: payload.productName,
        selectedMode: payload.managementMode,
        selectedContractPeriod: payload.contractPeriod,
        selectedRentalPrice: payload.monthlyPrice,
        rivalCompensationRequested: payload.isRivalCompensation,
        selectedColor: payload.selectedColor,
      },
    });
  } catch (e) {
    return { error: `Lead 동기화 실패: ${e instanceof Error ? e.message : String(e)}` };
  }

  const isNew = !existing;
  const source: ChangeSource = input.changeSource ?? (isNew ? "initial_create" : "internal_correction");

  // 트랜잭션: form upsert + history 기록 (분쟁 근거)
  const result = await prisma.$transaction(async tx => {
    let formId: string;
    if (existing) {
      await tx.enrollmentForm.update({ where: { id: existing.id }, data: payload });
      formId = existing.id;
    } else {
      const created = await tx.enrollmentForm.create({
        data: {
          ...payload,
          leadId: input.leadId,
          createdById: input.actorId,
          createdByRole: input.actorRole,
        },
      });
      formId = created.id;
    }

    // diff 계산 — 신규는 빈 diff (snapshotAfter 만 의미)
    const changes = isNew ? {} : diffPayload(existing as unknown as Record<string, unknown>, payload as unknown as Record<string, unknown>);

    // 변경 사항이 있을 때만 history 기록 (단, 신규는 항상 기록)
    if (isNew || Object.keys(changes).length > 0) {
      await tx.enrollmentFormHistory.create({
        data: {
          formId,
          leadId: input.leadId,
          changedById: input.actorId,
          changedByRole: input.actorRole,
          reason: input.changeReason?.trim() || null,
          changeSource: source,
          changes: changes as never,
          snapshotAfter: payload as never,
        },
      });
    }

    return { id: formId, isNew };
  });

  return { ok: true, ...result };
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

export function maskCardNumber(num: string, role: ActorRole, isOwnRecord: boolean): string {
  if (role === "hq" || role === "partner_admin") return num;
  if (role === "seller" && isOwnRecord) return num;
  if (num.length < 8) return num;
  return num.slice(0, 4) + "*".repeat(Math.max(0, num.length - 8)) + num.slice(-4);
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
    autoDebitAccount: form.autoDebitAccount ? maskAccount(form.autoDebitAccount, ctx.actorRole, isOwn) : null,
    cardNumber: form.cardNumber ? maskCardNumber(form.cardNumber, ctx.actorRole, isOwn) : null,
    giftAccount: form.giftAccount ? maskAccount(form.giftAccount, ctx.actorRole, isOwn) : null,
  };
}
