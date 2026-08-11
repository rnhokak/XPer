import { type SupabaseClient, type PostgrestError } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type CashflowQuickAddValues } from "@/lib/validation/cashflow";

type Supabase = SupabaseClient<Database, "public", "public">;

const TRANSACTION_SELECT =
  "id,type,amount,currency,note,transaction_time,category:categories(id,name,type),account:accounts(id,name,currency)";

type TransactionWithRelations =
  Database["public"]["Tables"]["transactions"]["Row"] & {
    category?: { id?: string | null; name?: string | null; type?: string | null } | null;
    account?: { id?: string | null; name?: string | null; currency?: string | null } | null;
  };

type BaseArgs = {
  supabase: Supabase;
  userId: string;
  values: CashflowQuickAddValues;
};

const resolveCurrency = async (supabase: Supabase, userId: string, values: CashflowQuickAddValues) => {
  let resolvedCurrency = values.currency?.trim();
  if (!resolvedCurrency && values.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("currency")
      .eq("user_id", userId)
      .eq("id", values.account_id)
      .maybeSingle();
    if (account?.currency) {
      resolvedCurrency = account.currency;
    }
  }
  return resolvedCurrency || "USD";
};

export const createCashflowTransaction = async ({
  supabase,
  userId,
  values,
}: BaseArgs): Promise<{ data: TransactionWithRelations | null; error: PostgrestError | null }> => {
  const currency = await resolveCurrency(supabase, userId, values);

  const payload: Database["public"]["Tables"]["transactions"]["Insert"] = {
    user_id: userId,
    type: values.type ?? "expense",
    amount: values.amount,
    account_id: values.account_id ?? null,
    category_id: values.category_id ?? null,
    currency,
    note: values.note?.trim() || null,
    transaction_time: values.transaction_time ? new Date(values.transaction_time).toISOString() : new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select(TRANSACTION_SELECT)
    .single();

  return { data: (data as TransactionWithRelations | null) ?? null, error };
};

type UpdateArgs = BaseArgs & { transactionId: string };

export const updateCashflowTransaction = async ({
  supabase,
  userId,
  transactionId,
  values,
}: UpdateArgs): Promise<{ error: PostgrestError | null }> => {
  const currency = await resolveCurrency(supabase, userId, values);

  const payload: Database["public"]["Tables"]["transactions"]["Update"] = {
    type: values.type ?? "expense",
    amount: values.amount,
    account_id: values.account_id ?? null,
    category_id: values.category_id ?? null,
    currency,
    note: values.note?.trim() || null,
    transaction_time: values.transaction_time ? new Date(values.transaction_time).toISOString() : new Date().toISOString(),
  };

  const { error } = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", transactionId)
    .eq("user_id", userId);

  return { error };
};
