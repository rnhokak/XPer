import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { partnerTransactionSchema } from "@/lib/validation/partners";
import { type Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

const getUserAndClient = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
};

const parseDateToIso = (value: string | null | undefined, fallback: Date) => {
  if (!value) return fallback.toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback.toISOString();
  return d.toISOString();
};

export async function POST(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = partnerTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const data = parsed.data;
  const now = new Date();

  let resolvedCurrency = data.currency?.trim() || null;
  if (!resolvedCurrency && data.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("currency")
      .eq("user_id", user.id)
      .eq("id", data.account_id)
      .maybeSingle();
    if (account?.currency) resolvedCurrency = account.currency;
  }

  const transactionType: TransactionInsert["type"] =
    data.direction === "lend" || data.direction === "repay" ? "expense" : "income";

  const { data: partnerRow } = await supabase
    .from("partners")
    .select("id")
    .eq("id", data.partner_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!partnerRow) {
    return NextResponse.json({ error: "Partner không tồn tại" }, { status: 400 });
  }

  const transactionPayload: TransactionInsert = {
    user_id: user.id,
    account_id: data.account_id ?? null,
    category_id: data.category_id ?? null,
    type: transactionType,
    amount: data.amount,
    currency: resolvedCurrency || "VND",
    note: data.note?.trim() || null,
    transaction_time: parseDateToIso(data.date, now),
  };

  const { data: insertedTx, error: txError } = await supabase
    .from("transactions")
    .insert(transactionPayload)
    .select("id")
    .single();

  if (txError || !insertedTx?.id) {
    return NextResponse.json({ error: txError?.message ?? "Failed to create cashflow transaction" }, { status: 500 });
  }

  const partnerTxPayload: Database["public"]["Tables"]["partner_transactions"]["Insert"] = {
    user_id: user.id,
    partner_id: data.partner_id,
    transaction_id: insertedTx.id,
    direction: data.direction,
    amount: data.amount,
    principal_amount: data.principal_amount ?? null,
    interest_amount: data.interest_amount ?? null,
    date: transactionPayload.transaction_time,
    note: data.note?.trim() || null,
  };

  const { error: partnerTxError } = await supabase.from("partner_transactions").insert(partnerTxPayload);
  if (partnerTxError) {
    await supabase.from("transactions").delete().eq("id", insertedTx.id).eq("user_id", user.id);
    return NextResponse.json({ error: partnerTxError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, transaction_id: insertedTx.id });
}
