import { type SupabaseClient, type PostgrestError } from "@supabase/supabase-js";
import { rangeStart } from "@/lib/cashflow/utils";
import { type Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database, "public", "public">;

export type TelegramReportRange = "today" | "week" | "month";

export type TelegramReportSummary = {
  income: number;
  expense: number;
  net: number;
};

export const fetchTelegramReport = async ({
  supabase,
  userId,
  range,
}: {
  supabase: Supabase;
  userId: string;
  range: TelegramReportRange;
}): Promise<{ summary: TelegramReportSummary | null; error: PostgrestError | null }> => {
  const start = rangeStart(range);

  let query = supabase
    .from("transactions")
    .select("type,amount")
    .eq("user_id", userId);

  if (start) {
    query = query.gte("transaction_time", start.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    return { summary: null, error };
  }

  const amounts = (data ?? []).reduce(
    (acc, tx) => {
      if (tx.type === "income") acc.income += Number(tx.amount || 0);
      if (tx.type === "expense") acc.expense += Number(tx.amount || 0);
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return {
    summary: {
      income: Math.round(amounts.income),
      expense: Math.round(amounts.expense),
      net: Math.round(amounts.income - amounts.expense),
    },
    error: null,
  };
};
