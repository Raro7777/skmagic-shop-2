/**
 * 약정 해지 환수 계산 (clawback) — SK매직 본사 정책.
 *
 * 정책 (2026-06-04 사용자 확정):
 *   - 가입 1년 이내 고객 해지 OR 직권해지 → partnerCommission + sellerMargin 전액 환수 (100%)
 *   - 1년 초과 → 환수 없음 (0)
 *   - 부분 환수 없음 (단일 규칙)
 *   - 1년 기준점 = 개통일 (lead.installCompletedAt 또는 install_done 처리 시점)
 *
 * ⚠ 주의: `HqPolicy.refundLimitRatio` 와 혼동 X.
 *   - `refundLimitRatio` = 협력점이 사은품/설치비로 줄 수 있는 환원 한도 (수수료의 ⅔)
 *   - 여기 헬퍼 = 약정 해지 시 본사가 받아갈 환수 금액
 *
 * 메모리: [[project-refund-policy]]
 */

/** 환수 사유 — 본사 정책상 1년 이내 둘 다 100% 환수. */
export type ClawbackReason =
  | "customer_terminated"  // 고객 해지 (자발적 약정 종료)
  | "force_terminated";    // 직권해지 (본사 강제 — 미납, 부정 가입 등)

export type ClawbackInput = {
  /** 개통일 — Lead.installCompletedAt. null 이면 아직 개통 안 됨 (환수 불가). */
  installCompletedAt: Date | null;
  /** 해지일 — null 이면 현재 시각 기준. */
  terminatedAt?: Date | null;
  /** 정산의 partnerCommission (본사 → 협력점 송금액 = 환수 대상 1). */
  partnerCommission: number;
  /** 정산의 sellerMargin (협력점 → 영업자 송금액 = 환수 대상 2). 영업자 없으면 0. */
  sellerMargin: number;
  /** 해지 사유 — 둘 다 동일 산식. (audit trail 용으로 받음) */
  reason: ClawbackReason;
};

export type ClawbackResult = {
  /** true 면 환수 발생, false 면 1년 초과로 환수 없음. */
  clawbackTriggered: boolean;
  /** 본사 → 협력점 환수 금액 (= partnerCommission 또는 0). */
  partnerClawbackAmount: number;
  /** 협력점 → 영업자 환수 금액 (= sellerMargin 또는 0). */
  sellerClawbackAmount: number;
  /** 총 환수 금액 (partner + seller). */
  totalClawbackAmount: number;
  /** 개통일로부터 해지까지 경과 일수. installCompletedAt null 이면 0. */
  daysSinceInstall: number;
  /** 디버깅용 사유 메시지. */
  note: string;
};

const ONE_YEAR_DAYS = 365;

/**
 * 환수 금액 계산.
 *
 *   const r = calcClawback({
 *     installCompletedAt: lead.installCompletedAt,
 *     terminatedAt: new Date(),
 *     partnerCommission: settlement.partnerCommission,
 *     sellerMargin: settlement.sellerMargin,
 *     reason: "customer_terminated",
 *   });
 *   // r.totalClawbackAmount 로 환수 진행
 */
export function calcClawback(input: ClawbackInput): ClawbackResult {
  const { installCompletedAt, terminatedAt, partnerCommission, sellerMargin, reason } = input;

  // 개통 안 했으면 환수 대상 X (이론상 발생 안 함 — 정산 자체가 install_done 후)
  if (!installCompletedAt) {
    return {
      clawbackTriggered: false,
      partnerClawbackAmount: 0,
      sellerClawbackAmount: 0,
      totalClawbackAmount: 0,
      daysSinceInstall: 0,
      note: "개통 전 — 환수 불가",
    };
  }

  const end = terminatedAt ?? new Date();
  const daysSinceInstall = Math.floor((end.getTime() - installCompletedAt.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceInstall < 0) {
    return {
      clawbackTriggered: false,
      partnerClawbackAmount: 0,
      sellerClawbackAmount: 0,
      totalClawbackAmount: 0,
      daysSinceInstall,
      note: "해지일이 개통일보다 빠름 — 데이터 오류 추정",
    };
  }

  if (daysSinceInstall > ONE_YEAR_DAYS) {
    return {
      clawbackTriggered: false,
      partnerClawbackAmount: 0,
      sellerClawbackAmount: 0,
      totalClawbackAmount: 0,
      daysSinceInstall,
      note: `1년 초과 (${daysSinceInstall}일) — 환수 없음`,
    };
  }

  // 1년 이내 → 100% 환수 (사유 무관)
  const partnerClawback = Math.max(0, Math.floor(partnerCommission));
  const sellerClawback = Math.max(0, Math.floor(sellerMargin));

  return {
    clawbackTriggered: true,
    partnerClawbackAmount: partnerClawback,
    sellerClawbackAmount: sellerClawback,
    totalClawbackAmount: partnerClawback + sellerClawback,
    daysSinceInstall,
    note: `1년 이내 (${daysSinceInstall}일) — ${reason === "customer_terminated" ? "고객 해지" : "직권해지"} 전액 환수`,
  };
}

/** 1년 이내인지만 빠르게 체크. UI 표시용. */
export function isWithinOneYear(installCompletedAt: Date | null, asOf?: Date): boolean {
  if (!installCompletedAt) return false;
  const end = asOf ?? new Date();
  const days = Math.floor((end.getTime() - installCompletedAt.getTime()) / (1000 * 60 * 60 * 24));
  return days >= 0 && days <= ONE_YEAR_DAYS;
}
