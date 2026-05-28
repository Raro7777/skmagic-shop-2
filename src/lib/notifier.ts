/**
 * 알림 채널 추상화 — 이메일 / SMS.
 *
 *   EMAIL_PROVIDER 값:
 *     - "resend" → Resend API 로 발송 (RESEND_API_KEY 필수)
 *     - 그 외/미설정 → console.log + NotificationOutbox 큐 (개발/스텁)
 *
 *   SMS_PROVIDER 는 현재 console 만. 추후 NHN Toast / Aligo 등 추가.
 */
import { prisma } from "./prisma";

export type EmailJob = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /**
   * NotificationOutbox.body 에 저장될 본문 + console fallback 출력값.
   * 임시 비밀번호 같은 secret 이 text 에 포함된 경우, 여기에 redacted placeholder 를 넘기면
   * DB / 운영 로그에는 평문이 남지 않음. 미지정 시 text 그대로 저장.
   */
  outboxBody?: string;
};

export type SmsJob = {
  to: string;
  text: string;
  outboxBody?: string;
};

/** 이메일 발송. */
export async function sendEmail(job: EmailJob): Promise<{ ok: boolean; provider: string; error?: string }> {
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  const storedBody = job.outboxBody ?? job.text;

  if (provider === "resend") {
    const result = await sendViaResend(job);
    await queueOutbox({
      channel: "email", to: job.to, subject: job.subject, body: storedBody, provider,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
    });
    return result.ok
      ? { ok: true, provider }
      : { ok: false, provider, error: result.error };
  }

  // 기본: 콘솔 + DB 큐 (외부 채널 결정 후 retry 가능).
  // production 에서 console provider 폴백이 발생하면 secret 누출 위험 → 경고 + redacted body 사용.
  if (process.env.NODE_ENV === "production") {
    console.warn(`⚠ EMAIL_PROVIDER 미설정 (production) — Resend 등 외부 채널 설정 필요. body redact 됨.`);
    console.log(`📧 [email/${provider}] → ${job.to}\n  subject: ${job.subject}\n  (body redacted in production console)`);
  } else {
    console.log(`📧 [email/${provider}] → ${job.to}\n  subject: ${job.subject}\n  text:\n${storedBody.replace(/^/gm, "    ")}`);
  }
  await queueOutbox({ channel: "email", to: job.to, subject: job.subject, body: storedBody, provider, status: "stub" });
  return { ok: true, provider };
}

export async function sendSms(job: SmsJob): Promise<{ ok: true; provider: string }> {
  const provider = process.env.SMS_PROVIDER ?? "console";
  const storedBody = job.outboxBody ?? job.text;
  if (process.env.NODE_ENV === "production") {
    console.log(`📱 [sms/${provider}] → ${job.to}\n  (body redacted in production console)`);
  } else {
    console.log(`📱 [sms/${provider}] → ${job.to}\n  text: ${storedBody}`);
  }
  await queueOutbox({ channel: "sms", to: job.to, body: storedBody, provider, status: "stub" });
  return { ok: true, provider };
}

/** Resend API 호출 — 실패 시 DB outbox 에 failed 로 남기고 호출자에게 error 반환. */
async function sendViaResend(job: EmailJob): Promise<{ ok: true; id: string } | { ok: false; error: string; id?: undefined }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY 미설정" };
  const fromAddress = process.env.RESEND_FROM ?? "Rentking <noreply@skmagic-shop.com>";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: job.to,
      subject: job.subject,
      text: job.text,
      ...(job.html && { html: job.html }),
    });
    if (error) return { ok: false, error: error.message ?? String(error) };
    return { ok: true, id: data?.id ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

/**
 * NotificationOutbox 적재. provider=resend 일 때는 발송 결과(sent/failed)도 함께 기록.
 */
async function queueOutbox(args: {
  channel: "email" | "sms";
  to: string;
  subject?: string;
  body: string;
  provider: string;
  status: string;
  error?: string | null;
}) {
  try {
    await prisma.notificationOutbox.create({
      data: {
        channel: args.channel,
        toAddress: args.to,
        subject: args.subject ?? null,
        body: args.body,
        provider: args.provider,
        status: args.status,
        ...(args.error && { lastError: args.error.slice(0, 500) }),
        ...(args.status === "sent" && { sentAt: new Date() }),
      },
    });
  } catch {
    // outbox 적재 실패해도 흐름은 계속
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
  // 임시비번이 포함된 본문은 outbox / 콘솔에 평문 저장 금지 — placeholder 로 대체.
  const outboxBody = [
    `${c.name ?? c.to} 님 ${role} 계정 ${c.isReset ? "비밀번호 재설정" : "발급"} 안내 이메일 발송.`,
    `(임시비밀번호 평문은 outbox 에 저장하지 않음 — 발송 직후 폐기)`,
    `로그인: ${c.loginUrl} · 이메일: ${c.to}`,
  ].join("\n");
  return sendEmail({ to: c.to, subject, text, outboxBody });
}
