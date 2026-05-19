/**
 * 비밀번호 정책 — 엄격 모드 (2026-05-13 결정).
 *
 *   - 최소 12자
 *   - 영문 대문자 / 소문자 / 숫자 / 특수문자 4종 모두 포함
 *   - 이메일 일부와 동일하지 않을 것
 *   - 흔한 패턴(qwerty, password 등) 금지
 *
 * P0-3: 임시 비밀번호 생성은 crypto.randomInt 사용 (Math.random 은 V8 PRNG
 * 복원 공격에 취약). 단일 비번 노출 시 후속 비번이 예측되는 사고 방지.
 */
import { randomInt } from "crypto";

const MIN_LENGTH = 12;

/**
 * P0-6: bcrypt cost factor 단일 출처 (12 — bcryptjs 기준 ~250ms).
 * 모든 비밀번호 해시 호출은 이 값을 사용해 partner_admin / seller / hq 가
 * 같은 강도로 저장되도록 통일.
 */
export const BCRYPT_COST = 12;
const MAX_LENGTH = 64;
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
const COMMON_WEAK = [
  "password", "passw0rd", "qwerty", "asdf", "zxcv", "1234", "abcd",
  "admin", "letmein", "welcome", "rentking", "skmagic",
];

export type PasswordIssue =
  | "too_short"
  | "too_long"
  | "not_string"
  | "missing_uppercase"
  | "missing_lowercase"
  | "missing_digit"
  | "missing_special"
  | "contains_email"
  | "too_common";

const ISSUE_MSG: Record<PasswordIssue, string> = {
  too_short:          `최소 ${MIN_LENGTH}자 이상`,
  too_long:           `최대 ${MAX_LENGTH}자 이하`,
  not_string:         "비밀번호는 문자열이어야 합니다.",
  missing_uppercase:  "영문 대문자(A-Z) 1자 이상 포함",
  missing_lowercase:  "영문 소문자(a-z) 1자 이상 포함",
  missing_digit:      "숫자(0-9) 1자 이상 포함",
  missing_special:    "특수문자(!@#$%^&* 등) 1자 이상 포함",
  contains_email:     "이메일 일부 문자열을 비밀번호로 사용 불가",
  too_common:         "흔한 단어/패턴 사용 불가 (admin, password, qwerty 등)",
};

/** 정책 통과 시 ok:true, 실패 시 모든 issue + 한국어 메시지 + reason(첫 번째) 반환 */
export function validatePassword(
  password: string,
  opts?: { email?: string },
): { ok: true } | { ok: false; reason: string; issues: PasswordIssue[]; messages: string[] } {
  const issues: PasswordIssue[] = [];

  if (typeof password !== "string") issues.push("not_string");
  else {
    if (password.length < MIN_LENGTH) issues.push("too_short");
    if (password.length > MAX_LENGTH) issues.push("too_long");
    if (!/[A-Z]/.test(password)) issues.push("missing_uppercase");
    if (!/[a-z]/.test(password)) issues.push("missing_lowercase");
    if (!/[0-9]/.test(password)) issues.push("missing_digit");
    if (!SPECIAL_RE.test(password)) issues.push("missing_special");

    if (opts?.email) {
      const localPart = opts.email.split("@")[0]?.toLowerCase();
      if (localPart && localPart.length >= 4 && password.toLowerCase().includes(localPart)) {
        issues.push("contains_email");
      }
    }

    const lower = password.toLowerCase();
    if (COMMON_WEAK.some(w => lower.includes(w))) issues.push("too_common");
  }

  if (issues.length === 0) return { ok: true };
  const messages = issues.map(i => ISSUE_MSG[i]);
  return { ok: false, reason: messages[0], issues, messages };
}

export const PASSWORD_POLICY_TEXT = [
  `최소 ${MIN_LENGTH}자 이상`,
  "영문 대문자 1자 이상",
  "영문 소문자 1자 이상",
  "숫자 1자 이상",
  "특수문자 1자 이상 (!@#$%^&* 등)",
  "이메일 일부·흔한 단어(password, qwerty 등) 사용 불가",
];

/**
 * 임시 비밀번호 생성 — HQ 가 협력점·영업자 발급 시 사용.
 * 새 정책 통과 보장: 14자, 대문자 3 + 소문자 4 + 숫자 4 + 특수문자 3, 헷갈리는 글자 제외.
 */
export function generateTempPassword(): string {
  const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // I, O 제외
  const LOWER = "abcdefghjkmnpqrstuvwxyz";  // i, l, o 제외
  const DIGIT = "23456789";                 // 0, 1 제외
  const SPECIAL = "!@#$%^&*";               // 안전한 특수문자만

  // P0-3: crypto.randomInt (CSPRNG) 사용 — Math.random() 의 V8 내부 상태 복원 공격 차단.
  const pick = (s: string, n: number) =>
    Array.from({ length: n }, () => s[randomInt(0, s.length)]);

  const chars = [
    ...pick(UPPER, 3),
    ...pick(LOWER, 4),
    ...pick(DIGIT, 4),
    ...pick(SPECIAL, 3),
  ];

  // Fisher-Yates 셔플 — randomInt 로 cryptographically secure.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
