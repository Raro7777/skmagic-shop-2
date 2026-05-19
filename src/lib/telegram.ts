/**
 * Telegram Bot 알림 헬퍼.
 *
 * 환경변수:
 *   TELEGRAM_BOT_TOKEN     - BotFather 발급 토큰 (필수). 없으면 모든 알림 no-op.
 *   TELEGRAM_CHAT_ID_HQ    - 본사 알림 채팅 ID (선택). 없으면 본사 알림 미발송.
 *
 * 협력점 알림은 Partner.telegramChatId 가 채워졌을 때만 발송.
 *
 * 발송 정책 — fire-and-forget. await 하지 않아 API 응답 지연이 없고,
 * 텔레그램 장애가 비즈니스 로직을 막지 않도록 항상 catch 후 console.error.
 */

const API_BASE = "https://api.telegram.org";

async function send(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — alert skipped");
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
      console.error(`[telegram] sendMessage failed chat=${chatId} status=${res.status} body=${body.slice(0, 200)}`);
    }
  } catch (e) {
    console.error("[telegram] sendMessage threw:", e instanceof Error ? e.message : e);
  }
}

/**
 * 본사 알림 — env TELEGRAM_CHAT_ID_HQ 로 발송.
 * fire-and-forget. 실패해도 비즈니스 로직 영향 없음.
 */
export function notifyHq(text: string): void {
  const chatId = process.env.TELEGRAM_CHAT_ID_HQ;
  if (!chatId) return;
  void send(chatId, text);
}

/**
 * 협력점 알림 — Partner.telegramChatId 가 있으면 발송.
 * fire-and-forget.
 */
export function notifyPartner(chatId: string | null | undefined, text: string): void {
  if (!chatId) return;
  void send(chatId, text);
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
