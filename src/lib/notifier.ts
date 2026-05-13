/**
 * 알림 채널 추상화 — 이메일 / SMS.
 *
 * 운영 환경에서는 `EMAIL_PROVIDER`, `SMS_PROVIDER` 환경변수로 어느 채널을 쓸지 결정.
 * 현재(2026-05-13)는 채널 미정 → console.log 로 fallback + DB(NotificationOutbox)에 큐잉.
 * 추후 Resend/SES 등 결정되면 provider 함수만 추가하면 됨.
 */
import { prisma } from "./prisma";

export type EmailJob = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SmsJob = {
  to: string;
  text: string;
};

/** 이메일 발송. 외부 채널 미설정 시 console + DB 큐. */
export async function sendEmail(job: EmailJob): Promise<{ ok: true; provider: string }> {
  const provider = process.env.EMAIL_PROVIDER ?? "console";

  // 외부 채널 결정 시 여기 분기 추가:
  // if (provider === "resend") return sendViaResend(job);
  // if (provider === "ses") return sendViaSES(job);

  // 기본: 콘솔 + DB 큐 (외부 채널 결정 후 retry 가능)
  console.log(`📧 [email/${provider}] → ${job.to}\n  subject: ${job.subject}\n  text:\n${job.text.replace(/^/gm, "    ")}`);
  await queueOutbox({ channel: "email", to: job.to, subject: job.subject, body: job.text, provider });
  return { ok: true, provider };
}

export async function sendSms(job: SmsJob): Promise<{ ok: true; provider: string }> {
  const provider = process.env.SMS_PROVIDER ?? "console";
  console.log(`📱 [sms/${provider}] → ${job.to}\n  text: ${job.text}`);
  await queueOutbox({ channel: "sms", to: job.to, body: job.text, provider });
  return { ok: true, provider };
}

/**
 * 채널이 결정되기 전까지 모든 알림을 NotificationOutbox 에 적재.
 * 추후 worker 가 미발송 항목을 retry.
 */
async function queueOutbox(args: { channel: "email" | "sms"; to: string; subject?: string; body: string; provider: string }) {
  try {
    await prisma.notificationOutbox.create({
      data: {
        channel: args.channel,
        toAddress: args.to,
        subject: args.subject ?? null,
        body: args.body,
        provider: args.provider,
        status: args.provider === "console" ? "stub" : "pending",
      },
    });
  } catch {
    // outbox 적재 실패해도 흐름은 계속 (콘솔에는 이미 찍힘)
  }
}

// ────────────────────────────────────────────────────────
// 도메인 전용 알림 — 임시 비번 발급 / 비번 재설정 안내
// ────────────────────────────────────────────────────────

export type CredentialMail = {
  to: string;
  name?: string | null;
  tempPassword: string;
  role: "hq" | "partner_admin" | "seller";
  loginUrl: string;
  isReset?: boolean;            // true 면 "비밀번호 재설정", false 면 "계정 신규 발급"
};

const ROLE_LABEL_FOR_EMAIL: Record<CredentialMail["role"], string> = {
  hq: "본사 관리자",
  partner_admin: "협력점 관리자",
  seller: "영업자",
};

export async function sendCredentialEmail(c: CredentialMail) {
  const role = ROLE_LABEL_FOR_EMAIL[c.role];
  const title = c.isReset ? "비밀번호 재설정 안내" : "계정 발급 안내";
  const subject = `[렌트왕] ${title} — ${role}`;
  const text = [
    `${c.name ?? c.to} 님 안녕하세요,`,
    "",
    `렌트왕 ${role} 계정의 ${c.isReset ? "비밀번호가 재설정" : "신규 계정이 발급"}되었습니다.`,
    "",
    `로그인 페이지: ${c.loginUrl}`,
    `이메일: ${c.to}`,
    `임시 비밀번호: ${c.tempPassword}`,
    "",
    "첫 로그인 직후 본인 비밀번호로 반드시 변경해주세요.",
    "이 임시 비밀번호는 변경 전까지 유효합니다.",
    "",
    "— 렌트왕 본사",
  ].join("\n");
  return sendEmail({ to: c.to, subject, text });
}
