import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createCashflowTransaction } from "@/features/cashflow/server/transactions";
import { parseTransactionIntent } from "@/features/integrations/telegram/transactionParser";
import { fetchTelegramReport } from "@/features/integrations/telegram/reporting";
import { sendMessage } from "@/features/integrations/telegram/telegramApi";

type Supabase = ReturnType<typeof createServiceRoleClient>;

type TelegramUser = {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramChat = {
  id: number;
  type?: string;
  title?: string;
  username?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.personalx.vn";

const normalizeText = (value?: string | null) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const formatCurrency = (amount: number) => {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(amount))}₫`;
};

const unauthorizedResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const getLinkedProfile = async (supabase: Supabase, telegramUserId: number) => {
  const { data } = await supabase
    .from("telegram_links")
    .select("user_id,telegram_chat_id,username,first_name,last_name")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  return data;
};

const resolveAccountId = async (supabase: Supabase, userId: string, keyword?: string | null) => {
  const { data } = await supabase
    .from("accounts")
    .select("id,name,is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (!data || data.length === 0) return null;
  if (keyword) {
    const normalizedKeyword = normalizeText(keyword);
    const match = data.find((account) => normalizeText(account.name).includes(normalizedKeyword));
    if (match) return match.id;
  }

  const preferred = data.find((account) => account.is_default);
  return preferred?.id ?? data[0]?.id ?? null;
};

const resolveCategoryId = async (
  supabase: Supabase,
  userId: string,
  type: "expense" | "income",
  keyword?: string | null,
  fallbackDescription?: string | null
) => {
  const { data } = await supabase
    .from("categories")
    .select("id,name,type,is_default")
    .eq("user_id", userId)
    .eq("type", type)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  if (!data || data.length === 0) return null;
  const normalizedKeyword = keyword ? normalizeText(keyword) : null;
  const normalizedFallback = fallbackDescription ? normalizeText(fallbackDescription) : null;

  if (normalizedKeyword) {
    const match = data.find((category) => normalizeText(category.name).includes(normalizedKeyword));
    if (match) return match.id;
  }

  if (normalizedFallback) {
    const match = data.find((category) => normalizeText(category.name).includes(normalizedFallback));
    if (match) return match.id;
  }

  const preferred = data.find((category) => category.is_default);
  return preferred?.id ?? data[0]?.id ?? null;
};

const ensureServiceClient = () => {
  try {
    return createServiceRoleClient();
  } catch (error) {
    console.error("Cannot create service role client:", error);
    throw error;
  }
};

const handleStart = async (chatId: number) => {
  const message = [
    "👋 Xin chào! Mình là bot ghi cashflow.",
    "1. Vào Settings → Telegram trong web app để lấy mã /link.",
    "2. Trên Telegram gửi `/link CODE` cho bot.",
    "3. Sau đó chỉ cần nhắn `chi cafe 45k` hoặc `thu luong 15tr` là xong.",
    "",
    "Lệnh hữu ích: /help /today /week /month /unlink",
  ].join("\n");
  await sendMessage(chatId, message);
};

const handleHelp = async (chatId: number) => {
  const message = [
    "📘 Hướng dẫn nhanh:",
    "",
    "• Ghi giao dịch:",
    "  chi cafe 45k",
    "  chi 120k an trua note: tham doi tac",
    "  thu luong 25tr",
    "",
    "• Báo cáo:",
    "  /today  /week  /month",
    "",
    "• Liên kết:",
    "  Trên web: Settings → Telegram → Tạo mã → /link CODE",
  ].join("\n");
  await sendMessage(chatId, message);
};

const handleLink = async (supabase: Supabase, chatId: number, from: TelegramUser, codeInput?: string) => {
  if (!codeInput) {
    await sendMessage(chatId, "Vui lòng nhập dạng /link ABC123.");
    return;
  }
  const code = codeInput.trim().toUpperCase();
  const { data: linkCode } = await supabase
    .from("telegram_link_codes")
    .select("id,user_id,code,expires_at,used_at")
    .eq("code", code)
    .maybeSingle();

  if (!linkCode) {
    await sendMessage(chatId, "Mã không hợp lệ hoặc đã bị xoá. Tạo mã mới trong Settings → Telegram.");
    return;
  }

  const now = Date.now();
  const expiresAt = new Date(linkCode.expires_at ?? "").getTime();
  if (linkCode.used_at || Number.isNaN(expiresAt) || expiresAt < now) {
    await sendMessage(chatId, "Mã này đã hết hạn. Hãy tạo mã mới rồi thử lại.");
    return;
  }

  await supabase.from("telegram_links").delete().eq("telegram_user_id", from.id);

  const payload = {
    user_id: linkCode.user_id,
    telegram_user_id: from.id,
    telegram_chat_id: chatId,
    username: from.username ?? null,
    first_name: from.first_name ?? null,
    last_name: from.last_name ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("telegram_links").upsert(payload, { onConflict: "user_id" });
  if (error) {
    console.error("Failed to upsert telegram link:", error);
    await sendMessage(chatId, "Không thể liên kết. Thử lại sau vài phút.");
    return;
  }

  await supabase.from("telegram_link_codes").update({ used_at: new Date().toISOString() }).eq("id", linkCode.id);

  await sendMessage(
    chatId,
    "✅ Đã liên kết thành công! Bây giờ bạn có thể nhắn \"chi cafe 45k\" hoặc dùng /today để xem báo cáo."
  );
};

const handleUnlink = async (supabase: Supabase, chatId: number, telegramUserId: number) => {
  const { data } = await supabase
    .from("telegram_links")
    .select("id,user_id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (!data) {
    await sendMessage(chatId, "Không tìm thấy liên kết. Dùng /link CODE để kết nối.");
    return;
  }

  await supabase.from("telegram_links").delete().eq("id", data.id);
  await sendMessage(chatId, "Đã hủy liên kết Telegram khỏi tài khoản.");
};

const handleReport = async (supabase: Supabase, chatId: number, telegramUserId: number, range: "today" | "week" | "month") => {
  const link = await getLinkedProfile(supabase, telegramUserId);
  if (!link) {
    await sendMessage(chatId, "Chưa liên kết tài khoản. Vào Settings → Telegram để lấy mã /link CODE.");
    return;
  }

  const { summary, error } = await fetchTelegramReport({ supabase, userId: link.user_id, range });
  if (error || !summary) {
    console.error("Failed to load report:", error);
    await sendMessage(chatId, "Không lấy được báo cáo. Thử lại sau.");
    return;
  }

  const label = range === "today" ? "Hôm nay" : range === "week" ? "7 ngày" : "Tháng này";
  const message = [
    `📊 Báo cáo ${label}`,
    `Thu: ${formatCurrency(summary.income)}`,
    `Chi: ${formatCurrency(summary.expense)}`,
    `Net: ${formatCurrency(summary.net)}`,
  ].join("\n");
  await sendMessage(chatId, message);
};

const handleTransactionMessage = async (supabase: Supabase, chatId: number, telegramUserId: number, text: string) => {
  const link = await getLinkedProfile(supabase, telegramUserId);
  if (!link) {
    await sendMessage(chatId, "Chưa liên kết tài khoản. Vào Settings → Telegram để lấy mã /link CODE.");
    return;
  }

  const parsed = parseTransactionIntent(text);
  if (!parsed.success) {
    await sendMessage(
      chatId,
      "Không đọc được giao dịch. Ví dụ:\n• chi cafe 45k\n• thu luong 25tr\n• chi 120k an trua note: tiec"
    );
    return;
  }

  const accountId = await resolveAccountId(supabase, link.user_id, parsed.intent.accountKeyword ?? undefined);
  const categoryId = await resolveCategoryId(
    supabase,
    link.user_id,
    parsed.intent.type,
    parsed.intent.categoryKeyword ?? undefined,
    parsed.intent.description
  );

  const note = parsed.intent.note ?? parsed.intent.description;
  const { data, error } = await createCashflowTransaction({
    supabase,
    userId: link.user_id,
    values: {
      type: parsed.intent.type,
      amount: parsed.intent.amount,
      account_id: accountId,
      category_id: categoryId,
      note,
      transaction_time: new Date().toISOString(),
    },
  });

  if (error || !data) {
    console.error("Failed to create Telegram transaction:", error);
    await sendMessage(chatId, "Không ghi được giao dịch. Thử lại sau nhé.");
    return;
  }

  const verb = parsed.intent.type === "expense" ? "CHI" : "THU";
  const response = [
    `✅ Đã ghi ${verb} ${formatCurrency(parsed.intent.amount)}${note ? ` - ${note}` : ""}`,
    new Date(data.transaction_time).toLocaleString("vi-VN"),
    `Xem chi tiết: ${SITE_URL}/cashflow`,
  ].join("\n");
  await sendMessage(chatId, response);
};

export async function POST(req: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("TELEGRAM_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
  }

  const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (receivedSecret !== webhookSecret) {
    return unauthorizedResponse;
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) {
    return NextResponse.json({ ok: true });
  }

  const message = update.message ?? update.edited_message;
  if (!message || !message.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat?.id;
  const from = message.from;
  if (!chatId || !from?.id || from.is_bot) {
    return NextResponse.json({ ok: true });
  }

  const supabase = ensureServiceClient();
  const text = message.text.trim();

  try {
    if (text.startsWith("/")) {
      const [commandPart, ...rest] = text.split(/\s+/);
      const command = commandPart.split("@")[0]?.toLowerCase();
      const argument = rest.join(" ").trim();

      switch (command) {
        case "/start":
          await handleStart(chatId);
          break;
        case "/help":
          await handleHelp(chatId);
          break;
        case "/link":
          await handleLink(supabase, chatId, from, argument);
          break;
        case "/unlink":
          await handleUnlink(supabase, chatId, from.id);
          break;
        case "/today":
          await handleReport(supabase, chatId, from.id, "today");
          break;
        case "/week":
          await handleReport(supabase, chatId, from.id, "week");
          break;
        case "/month":
          await handleReport(supabase, chatId, from.id, "month");
          break;
        default:
          await handleHelp(chatId);
          break;
      }
    } else {
      await handleTransactionMessage(supabase, chatId, from.id, text);
    }
  } catch (error) {
    console.error("Telegram webhook error:", error);
    await sendMessage(chatId, "Bot gặp lỗi. Thử lại sau vài phút.");
  }

  return NextResponse.json({ ok: true });
}
