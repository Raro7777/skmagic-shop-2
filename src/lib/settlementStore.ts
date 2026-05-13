/**
 * Settlement 환수 프로세스 — 본사 전담
 *
 * refundStatus 진행:
 *   null → refund_pending → refund_progress → refund_done
 *
 * 진입 조건:
 *   Settlement.status === "paid"  AND  refundStatus === null  → 환수 시작 가능
 */
import { prisma } from "./prisma";

export type RefundStatus = "refund_pending" | "refund_progress" | "refund_done";

export const REFUND_LABEL: Record<RefundStatus, string> = {
  refund_pending:  "환수 예정",
  refund_progress: "환수 진행 중",
  refund_done:     "환수 완료",
};

export const REFUND_PILL: Record<RefundStatus, string> = {
  refund_pending:  "bg-rk-tint-orange text-rk-orange-deep",
  refund_progress: "bg-rk-tint-blue text-rk-info",
  refund_done:     "bg-rk-tint-gray text-rk-muted",
};

const ORDER: RefundStatus[] = ["refund_pending", "refund_progress", "refund_done"];

function nextRefundStatus(cur: RefundStatus): RefundStatus | null {
  const i = ORDER.indexOf(cur);
  if (i < 0 || i + 1 >= ORDER.length) return null;
  return ORDER[i + 1];
}

export async function startRefund(input: {
  settlementId: string;
  amount: number;
  reason: string;
}): Promise<{ ok: true } | { error: string }> {
  if (input.amount <= 0) return { error: "환수 금액은 1 이상이어야 합니다." };
  if (!input.reason?.trim()) return { error: "환수 사유를 입력하세요." };

  const s = await prisma.settlement.findUnique({ where: { id: input.settlementId } });
  if (!s) return { error: "Settlement not found" };
  if (s.status !== "paid") return { error: `환수는 송금 완료(paid) 정산만 가능합니다. (현재 status=${s.status})` };
  if (s.refundStatus) return { error: `이미 환수 프로세스 진행 중입니다. (refundStatus=${s.refundStatus})` };
  // 환수 한도 = 협력점 송금액 + 본사가 별도 지급한 렌탈지원 캐시백
  const maxRefund = s.netPayout + (s.rentalSupportReturned ?? 0);
  if (input.amount > maxRefund) {
    return { error: `환수 금액(${input.amount})이 한도(${maxRefund} = 송금 ${s.netPayout} + 렌탈지원 ${s.rentalSupportReturned ?? 0})를 초과합니다.` };
  }

  await prisma.settlement.update({
    where: { id: input.settlementId },
    data: {
      refundStatus: "refund_pending",
      refundAmount: input.amount,
      refundReason: input.reason.trim().slice(0, 256),
      refundStartedAt: new Date(),
      refundCompletedAt: null,
    },
  });
  return { ok: true };
}

export async function advanceRefund(settlementId: string): Promise<{ ok: true; to: RefundStatus } | { error: string }> {
  const s = await prisma.settlement.findUnique({ where: { id: settlementId } });
  if (!s) return { error: "Settlement not found" };
  if (!s.refundStatus) return { error: "환수가 시작되지 않은 정산입니다." };
  const next = nextRefundStatus(s.refundStatus as RefundStatus);
  if (!next) return { error: `이미 환수 완료 단계입니다. (refundStatus=${s.refundStatus})` };

  await prisma.settlement.update({
    where: { id: settlementId },
    data: {
      refundStatus: next,
      refundCompletedAt: next === "refund_done" ? new Date() : null,
    },
  });
  return { ok: true, to: next };
}

export async function cancelRefund(settlementId: string): Promise<{ ok: true } | { error: string }> {
  const s = await prisma.settlement.findUnique({ where: { id: settlementId } });
  if (!s) return { error: "Settlement not found" };
  if (!s.refundStatus) return { error: "환수가 시작되지 않은 정산입니다." };
  if (s.refundStatus === "refund_done") return { error: "이미 환수 완료된 정산은 되돌릴 수 없습니다. (감사 로그 보존)" };

  await prisma.settlement.update({
    where: { id: settlementId },
    data: {
      refundStatus: null,
      refundAmount: null,
      refundReason: null,
      refundStartedAt: null,
      refundCompletedAt: null,
    },
  });
  return { ok: true };
}
