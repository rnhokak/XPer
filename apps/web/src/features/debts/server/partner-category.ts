import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database, "public", "public">;

const DEBT_ROOT_NAME = "Debt";

export const ensureDebtRootCategory = async (supabase: Supabase, userId: string) => {
  const { data: root, error } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "debt")
    .eq("level", 0)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error) {
    return { id: null as string | null, error };
  }

  if (root?.id) {
    return { id: root.id, error: null };
  }

  const { data: created, error: insertError } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name: DEBT_ROOT_NAME,
      type: "debt",
      level: 0,
    })
    .select("id")
    .single();

  return { id: created?.id ?? null, error: insertError };
};

export const ensurePartnerCategory = async (
  supabase: Supabase,
  userId: string,
  partner: { name: string; category_id?: string | null }
) => {
  const partnerName = partner.name.trim();

  if (partner.category_id) {
    await supabase
      .from("categories")
      .update({ name: partnerName })
      .eq("id", partner.category_id)
      .eq("user_id", userId);
    return { id: partner.category_id, error: null };
  }

  const { id: rootId, error: rootError } = await ensureDebtRootCategory(supabase, userId);
  if (rootError || !rootId) {
    return { id: null as string | null, error: rootError ?? new Error("Missing debt root") };
  }

  const { data: existing, error: findError } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "debt")
    .eq("parent_id", rootId)
    .eq("name", partnerName)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (findError) {
    return { id: null as string | null, error: findError };
  }

  if (existing?.id) {
    return { id: existing.id, error: null };
  }

  const { data: created, error: insertError } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name: partnerName,
      type: "debt",
      level: 1,
      parent_id: rootId,
    })
    .select("id")
    .single();

  return { id: created?.id ?? null, error: insertError };
};

