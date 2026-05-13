/**
 * Lead 라이프사이클 — 14단계 / 5 phase
 *
 * 상담 → 신청 → 인증 → 설치 → 정산 → (환수)
 *
 * 자동 chain (사용자가 누르면 시스템이 같은 트랜잭션에서 추가 한 단계 더 이동):
 *   apply_submitted → verify_pending
 *   verify_passed   → install_pending
 *   install_done    → settle_pending   (Settlement 자동 생성)
 *
 * 환수(refund)는 Settlement 별도 status 로 처리 — Lead 흐름은 settle_done 까지.
 */

export const LEAD_STATUSES = [
  "consult_wish",     // 상담희망 (신규 lead 인입)
  "consult_active",   // 상담중
  "consult_closed",   // 상담종료 (미접수)
  "form_ready",       // 신청서 작성 완료 (EnrollmentForm 존재, 본사 제출 직전)
  "apply_submitted",  // 신청완료 (본사 제출)
  "verify_pending",   // 인증대기 (본사 큐)
  "verify_passed",    // 인증완료
  "verify_failed",    // 인증실패 (영업점 회송)
  "verify_revise",    // 수정요청 (영업점 회송)
  "revise_resubmit",  // 회신상태 (영업점이 보완 작성)
  "install_pending",  // 설치대기
  "install_done",     // 설치완료
  "install_cancel",   // 설치취소 (종료)
  "settle_pending",   // 정산대기
  "settle_done",      // 정산완료 (종료, 환수 진입 가능)
] as const;

export type LeadStatus = typeof LEAD_STATUSES[number];

export type ActorRole = "seller" | "partner_admin" | "hq";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  consult_wish:    "상담희망",
  consult_active:  "상담중",
  consult_closed:  "상담종료",
  form_ready:      "신청서 작성됨",
  apply_submitted: "신청완료",
  verify_pending:  "인증대기",
  verify_passed:   "인증완료",
  verify_failed:   "인증실패",
  verify_revise:   "수정요청",
  revise_resubmit: "회신상태",
  install_pending: "설치대기",
  install_done:    "설치완료",
  install_cancel:  "설치취소",
  settle_pending:  "정산대기",
  settle_done:     "정산완료",
};

export const STATUS_PHASE: Record<LeadStatus, "consult" | "verify" | "install" | "settle" | "closed"> = {
  consult_wish:    "consult",
  consult_active:  "consult",
  consult_closed:  "closed",
  form_ready:      "consult", // 상담 phase 안에 같이 둠 (작성 완료, 본사 제출 직전)
  apply_submitted: "verify",
  verify_pending:  "verify",
  verify_passed:   "verify",
  verify_failed:   "verify",
  verify_revise:   "verify",
  revise_resubmit: "verify",
  install_pending: "install",
  install_done:    "install",
  install_cancel:  "closed",
  settle_pending:  "settle",
  settle_done:     "settle",
};

/** Tailwind pill 클래스 — UI 공통 사용 */
export const STATUS_PILL: Record<LeadStatus, string> = {
  consult_wish:    "bg-rk-tint-blue text-rk-info",
  consult_active:  "bg-rk-tint-orange text-rk-orange-deep",
  consult_closed:  "bg-rk-tint-gray text-rk-muted",
  form_ready:      "bg-rk-tint-green text-rk-success",
  apply_submitted: "bg-rk-tint-blue text-rk-info",
  verify_pending:  "bg-rk-tint-orange text-rk-orange-deep",
  verify_passed:   "bg-rk-tint-green text-rk-success",
  verify_failed:   "bg-rk-tint-red text-rk-sale",
  verify_revise:   "bg-rk-tint-red text-rk-sale",
  revise_resubmit: "bg-rk-tint-orange text-rk-orange-deep",
  install_pending: "bg-rk-tint-blue text-rk-info",
  install_done:    "bg-rk-tint-green text-rk-success",
  install_cancel:  "bg-rk-tint-gray text-rk-muted",
  settle_pending:  "bg-rk-tint-blue text-rk-info",
  settle_done:     "bg-rk-tint-green text-rk-success",
};

/** 종료(더이상 전이 없음) 상태 */
export function isTerminal(s: LeadStatus): boolean {
  return s === "consult_closed" || s === "install_cancel" || s === "settle_done";
}

type Transition = {
  from: LeadStatus;
  to: LeadStatus;
  actors: readonly ActorRole[];
  /** true 면 사용자가 from→to 를 누르면 시스템이 자동으로 한 번 더 진행 */
  auto?: boolean;
};

/**
 * 명시적 전이 매트릭스.
 * 행은 from, 열은 to, 값은 해당 전이를 일으킬 수 있는 actor 집합.
 *
 * 본사(hq) 는 추가로 bypassStateMachine 모드로 임의 역전이 가능 — API 레이어에서 활용.
 */
export const TRANSITIONS: readonly Transition[] = [
  // ── 상담 단계 (영업/협력/본사) ──
  { from: "consult_wish",    to: "consult_active",   actors: ["seller", "partner_admin", "hq"] },
  { from: "consult_wish",    to: "consult_closed",   actors: ["seller", "partner_admin", "hq"] },
  { from: "consult_active",  to: "consult_closed",   actors: ["seller", "partner_admin", "hq"] },

  // ── 신청서 작성 (EnrollmentForm 필수, leadStore 가드) ──
  { from: "consult_active",  to: "form_ready",       actors: ["seller", "partner_admin", "hq"] },
  // 작성 도중 되돌리기 (작성 취소)
  { from: "form_ready",      to: "consult_active",   actors: ["seller", "partner_admin", "hq"] },
  { from: "form_ready",      to: "consult_closed",   actors: ["seller", "partner_admin", "hq"] },

  // ── 본사 제출 (협력점/영업자가 form_ready 에서 제출 → 자동 chain → verify_pending) ──
  { from: "form_ready",      to: "apply_submitted",  actors: ["seller", "partner_admin", "hq"] },
  { from: "apply_submitted", to: "verify_pending",   actors: ["seller", "partner_admin", "hq"], auto: true },

  // ── 인증 (본사 전담) ──
  { from: "verify_pending",  to: "verify_passed",    actors: ["hq"] },
  { from: "verify_pending",  to: "verify_failed",    actors: ["hq"] },
  { from: "verify_pending",  to: "verify_revise",    actors: ["hq"] },

  // ── 인증완료 → 설치대기 (자동) ──
  { from: "verify_passed",   to: "install_pending",  actors: ["hq"], auto: true },

  // ── 회송 (영업/협력이 회신 작성) ──
  { from: "verify_failed",   to: "revise_resubmit",  actors: ["seller", "partner_admin", "hq"] },
  { from: "verify_revise",   to: "revise_resubmit",  actors: ["seller", "partner_admin", "hq"] },
  // 회신 후 신청서 보완 → form_ready 거쳐 재제출 (form_ready 같은 단계 재사용)
  { from: "revise_resubmit", to: "form_ready",       actors: ["seller", "partner_admin", "hq"] },
  // (호환) 본사가 빠르게 통과시키고 싶을 때 form_ready 안 거치고 직접 제출도 허용
  { from: "revise_resubmit", to: "apply_submitted",  actors: ["seller", "partner_admin", "hq"] },

  // ── 설치 (본사 전담) ──
  { from: "install_pending", to: "install_done",     actors: ["hq"] },
  { from: "install_pending", to: "install_cancel",   actors: ["hq"] },

  // ── 설치완료 → 정산대기 (자동, Settlement 생성) ──
  { from: "install_done",    to: "settle_pending",   actors: ["hq"], auto: true },

  // ── 정산 (본사 전담) ──
  { from: "settle_pending",  to: "settle_done",      actors: ["hq"] },
];

export function canTransition(from: LeadStatus, to: LeadStatus, role: ActorRole): boolean {
  return TRANSITIONS.some(t => t.from === from && t.to === to && t.actors.includes(role));
}

/** to 상태에 진입하면 시스템이 자동으로 한 단계 더 보낼 다음 상태 (없으면 null) */
export function autoFollowup(to: LeadStatus): LeadStatus | null {
  const t = TRANSITIONS.find(x => x.from === to && x.auto);
  return t ? t.to : null;
}

/** 사용자가 누른 전이 + 자동 chain 을 모두 평탄화한 시퀀스 */
export function resolveChain(from: LeadStatus, to: LeadStatus): LeadStatus[] {
  const chain: LeadStatus[] = [to];
  let cur = to;
  while (true) {
    const next = autoFollowup(cur);
    if (!next) break;
    chain.push(next);
    cur = next;
  }
  return chain;
}

/** Settlement 자동 생성 트리거 여부 — chain 안에 install_done → settle_pending 이 포함된 경우 */
export function chainCreatesSettlement(chain: LeadStatus[]): boolean {
  for (let i = 0; i < chain.length - 1; i++) {
    if (chain[i] === "install_done" && chain[i + 1] === "settle_pending") return true;
  }
  return false;
}
