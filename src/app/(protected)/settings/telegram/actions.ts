"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const generateCode = (length = 6) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
};

export async function generateLinkCodeAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  await supabase.from("telegram_link_codes").delete().eq("user_id", user.id).is("used_at", null);

  const code = generateCode(6);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("telegram_link_codes")
    .insert({ user_id: user.id, code, expires_at: expiresAt })
    .select("code,expires_at")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to create link code" };
  }

  return { success: true, code: data.code, expiresAt: data.expires_at };
}

export async function unlinkTelegramAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase.from("telegram_links").delete().eq("user_id", user.id);
  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/telegram");
  return { success: true };
}
