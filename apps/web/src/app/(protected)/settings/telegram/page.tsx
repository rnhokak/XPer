import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TelegramSettingsPageClient } from "@/features/settings/telegram/TelegramSettingsPageClient";

export const dynamic = "force-dynamic";

export default async function TelegramSettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("telegram_links")
    .select("telegram_user_id,telegram_chat_id,username,first_name,last_name,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-12">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Telegram</h1>
        <p className="text-sm text-muted-foreground">Liên kết tài khoản Telegram để ghi cashflow nhanh.</p>
      </div>
      <TelegramSettingsPageClient
        initialLink={
          link
            ? {
                username: link.username,
                first_name: link.first_name,
                last_name: link.last_name,
                telegram_user_id: link.telegram_user_id,
                telegram_chat_id: link.telegram_chat_id,
                created_at: link.created_at,
              }
            : null
        }
      />
    </div>
  );
}
