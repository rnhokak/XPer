const TELEGRAM_API_BASE = "https://api.telegram.org";

type SendMessageOptions = {
  parse_mode?: "Markdown" | "HTML";
  disable_web_page_preview?: boolean;
};

export const escapeTelegramMarkdown = (input: string) => {
  return input.replace(/[_*[\]()~`>#+=|{}.!-]/g, (char) => `\\${char}`);
};

export async function sendMessage(chatId: number, text: string, options: SendMessageOptions = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not configured");
    return { ok: false, error: "Bot token missing" };
  }

  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...options,
  };

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.ok === false)) {
    const message = (json as { description?: string } | null)?.description ?? res.statusText;
    console.error("Failed to send Telegram message:", message);
    return { ok: false, error: message };
  }

  return { ok: true };
}
