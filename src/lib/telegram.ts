/**
 * Telegram Bot 알림 헬퍼.
 *
 * 환경변수:
 *   TELEGRAM_BOT_TOKEN     - BotFather 발급 토큰 (필수). 없으면 모든 알림 no-op.
 *   TELEGRAM_CHAT_ID_HQ    - 본사 알림 채팅 ID (선택). 없으면 본사 알림 미발송 (warn 로그).
 *
 * 협력점 알림은 Partner.telegramChatId 가 채워졌을 때만 발송.
 *
 * 발송 정책 — fire-and-forget. await 하지 않아 API 응답 지연이 없고,
 * 텔레그램 장애가 비즈니스 로직을 막지 않도록 항상 catch 후 console.error.
 *
 * 가시성 — 모든 발송 시도/결과를 NotificationOutbox 에 기록 (channel="telegram").
 * 발송 실패 / 미설정 케이스도 status="skipped"/"failed" 로 남겨 admin 콘솔에서 추적 가능.
 */
import { prisma } from "./prisma";

const API_BASE = "https://api.telegram.org";

type Recipient = "hq" | "partner" | "seller" | string;

async function logOutbox(args: {
  to: string;
  recipient: Recipient;
  bodyPreview: string;
  status: "sent" | "failed" | "skipped";
  error?: string | null;
}): Promise<void> {
  try {
    await prisma.notificationOutbox.create({
      data: {
        channel: "telegram",
        toAddress: args.to,
        subject: `[telegram/${args.recipient}]`,
        body: args.bodyPreview.slice(0, 800),
        provider: "telegram",
        status: args.status,
        ...(args.error && { lastError: args.error.slice(0, 500) }),
        ...(args.status === "sent" && { sentAt: new Date() }),
      },
    });
  } catch {
    // outbox 적재 실패해도 발송 로직은 계속
  }
}

async function send(chatId: string, text: string, recipient: Recipient = "unknown"): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — alert skipped");
    await logOutbox({ to: chatId, recipient, bodyPreview: text, status: "skipped", error: "TELEGRAM_BOT_TOKEN not set" });
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const errMsg = `status=${res.status} body=${body.slice(0, 200)}`;
      console.error(`[telegram] sendMessage failed chat=${chatId} ${errMsg}`);
      await logOutbox({ to: chatId, recipient, bodyPreview: text, status: "failed", error: errMsg });
    } else {
      await logOutbox({ to: chatId, recipient, bodyPreview: text, status: "sent" });
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[telegram] sendMessage threw:", errMsg);
    await logOutbox({ to: chatId, recipient, bodyPreview: text, status: "failed", error: errMsg });
  }
}

/**
 * 본사 알림 — env TELEGRAM_CHAT_ID_HQ 로 발송.
 * fire-and-forget. 실패해도 비즈니스 로직 영향 없음.
 * env 미설정 시 console.warn + outbox 에 "skipped" 기록 (운영자가 누락 인지 가능).
 */
export function notifyHq(text: string): void {
  const chatId = process.env.TELEGRAM_CHAT_ID_HQ;
  if (!chatId) {
    console.warn("[telegram] TELEGRAM_CHAT_ID_HQ not set — HQ alert skipped");
    void logOutbox({ to: "(env:TELEGRAM_CHAT_ID_HQ)", recipient: "hq", bodyPreview: text, status: "skipped", error: "TELEGRAM_CHAT_ID_HQ env not set" });
    return;
  }
  void send(chatId, text, "hq");
}

/**
 * 협력점 알림 — Partner.telegramChatId 가 있으면 발송.
 * 미설정 시 outbox 에 "skipped" 기록 (협력점이 chat_id 입력 안 한 케이스 추적 가능).
 */
export function notifyPartner(chatId: string | null | undefined, text: string): void {
  if (!chatId) {
    void logOutbox({ to: "(partner.telegramChatId=null)", recipient: "partner", bodyPreview: text, status: "skipped", error: "Partner/Seller telegramChatId not set" });
    return;
  }
  void send(chatId, text, "partner");
}

/**
 * 본사 + 협력점 둘 다 알림. partnerChatId 가 null 이면 본사에만.
 */
export function notifyHqAndPartner(partnerChatId: string | null | undefined, text: string): void {
  notifyHq(text);
  notifyPartner(partnerChatId, text);
}

/** HTML 이스케이프 — 사용자 입력값을 메시지에 넣을 때 사용. */
export function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
}
