/**
 * 텔레그램 봇으로 받은 메시지 보기 — chat_id 확인용.
 *
 * 사용법:
 *   1) 텔레그램에서 본인이 봇과 대화 시작 (메시지 한 번 보내기)
 *   2) npx tsx scripts/telegram-getupdates.ts
 *   → 출력에서 chat.id 가 본사 (또는 협력점) 의 chat_id
 *
 * 그룹의 chat_id 를 받으려면 봇을 그룹에 초대 후 그룹에서 메시지 한 번.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("✗ TELEGRAM_BOT_TOKEN 미설정. .env.local 에 추가하세요.");
    process.exit(1);
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = await res.json();
  if (!data.ok) {
    console.error("✗ Telegram API 오류:", data);
    process.exit(1);
  }
  if (!Array.isArray(data.result) || data.result.length === 0) {
    console.log("ⓘ 받은 메시지가 없습니다. 텔레그램에서 봇에게 메시지를 한 번 보낸 후 다시 실행하세요.");
    console.log("  봇 사용자명을 모르면 https://api.telegram.org/bot${TOKEN}/getMe 로 확인 가능.");
    return;
  }
  console.log("=== 받은 메시지 (최근순) ===\n");
  for (const u of data.result.reverse()) {
    const m = u.message ?? u.edited_message ?? u.channel_post;
    if (!m) continue;
    const c = m.chat;
    const fromName = m.from?.first_name ? `${m.from.first_name}${m.from.last_name ? ` ${m.from.last_name}` : ""}` : "(unknown)";
    console.log(`chat.id: ${c.id}  (type=${c.type}${c.title ? `, title="${c.title}"` : ""})`);
    console.log(`  from: ${fromName} ${m.from?.username ? `@${m.from.username}` : ""}`);
    console.log(`  text: ${(m.text ?? "(non-text)").slice(0, 80)}`);
    console.log("");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
