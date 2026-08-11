````md
# AI TELEGRAM BOT GUIDE

This guide explains how to configure and operate the multi-user Telegram bot integration for the Cashflow module.

---

## Environment Variables

Set these variables for production and local testing:

- `TELEGRAM_BOT_TOKEN` – Bot token from @BotFather, used for outbound API calls.
- `TELEGRAM_WEBHOOK_SECRET` – Random string Telegram includes via `x-telegram-bot-api-secret-token` to authenticate webhook calls.
- `NEXT_PUBLIC_SITE_URL` – Public site root (e.g. `https://app.example.com`). Used in bot replies and deep links.
- `SUPABASE_SERVICE_ROLE_KEY` – **Server-only** key so the webhook can bypass RLS safely. Never expose to the browser.

The Supabase URL + anon key are already required elsewhere in the project.

---

## Webhook Setup

Run the following command once per environment (replace placeholders):

```
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://yourdomain.com/api/telegram/webhook\",\"secret_token\":\"$TELEGRAM_WEBHOOK_SECRET\"}"
```

To inspect or reset the webhook:

```
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
```

Make sure your deployment URL matches `NEXT_PUBLIC_SITE_URL` and is reachable over HTTPS.

---

## Linking & Usage Flow

1. User opens `/settings/telegram` inside the app, generates a one-time link code, and sees instructions.
2. On Telegram, the user sends `/link CODE` to the bot. The webhook validates the code and stores the `telegram_links` row.
3. After linking, the user can:
   - Send natural text like `chi cafe 45k` or `thu luong 20tr` to create transactions (using existing Cashflow logic).
   - Call `/today`, `/week`, `/month` for quick summaries.
   - Send `/unlink` to disconnect.

Each Telegram account links to exactly one Supabase user, enforced in `telegram_links`.

---

## Debug Checklist

- Use `getWebhookInfo` to verify the current webhook URL and last error.
- Confirm `TELEGRAM_WEBHOOK_SECRET` matches the value configured at Telegram; mismatched secrets return `401`.
- Monitor server logs for `Telegram webhook error` or `Failed to create/send` entries.
- Run `supabase db diff` / migrations to create `telegram_links` and `telegram_link_codes` tables with RLS.
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is present wherever `/api/telegram/webhook` runs (Vercel env, local dev).

With these steps, the Telegram bot can safely read multi-user updates and reuse the shared transaction logic.
````
