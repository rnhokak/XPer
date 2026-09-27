import { type SupabaseClient, type PostgrestError } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type CashflowQuickAddValues } from "@/lib/validation/cashflow";

type Supabase = SupabaseClient<Database, "public", "public">;

const TRANSACTION_SELECT =
  "id,type,flow_type,transfer_peer_id,amount,currency,note,transaction_time,destination_amount,destination_currency,exchange_rate,destination_account_id,category:categories(id,name,type),account:accounts!transactions_account_id_fkey(id,name,currency,type),destination_account:accounts!transactions_destination_account_id_fkey(id,name,currency,type)";

type TransactionWithRelations =
  Database["public"]["Tables"]["transactions"]["Row"] & {
    category?: { id?: string | null; name?: string | null; type?: string | null } | null;
    account?: { id?: string | null; name?: string | null; currency?: string | null; type?: string | null } | null;
    destination_account?: { id?: string | null; name?: string | null; currency?: string | null; type?: string | null } | null;
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
  return resolvedCurrency || "VND";
};

export const createCashflowTransaction = async ({
  supabase,
  userId,
  values,
}: BaseArgs): Promise<{
  data: TransactionWithRelations | null;
  peer?: TransactionWithRelations | null;
  error: PostgrestError | null;
}> => {
  const currency = await resolveCurrency(supabase, userId, values);
  const txTime = values.transaction_time ? new Date(values.transaction_time).toISOString() : new Date().toISOString();

  if (values.type === "transfer") {
    let destCurrency = values.destination_currency?.trim();
    if (!destCurrency && values.destination_account_id) {
      const { data: destAcc } = await supabase
        .from("accounts")
        .select("currency")
        .eq("user_id", userId)
        .eq("id", values.destination_account_id)
        .maybeSingle();
      if (destAcc?.currency) {
        destCurrency = destAcc.currency;
      }
    }
    destCurrency = destCurrency || currency;

    const sourceAmount = values.amount;
    const destAmount = values.destination_amount ?? values.amount;

    // 1. Record 1: Outflow (source account, flow_type: false = decrease)
    const payloadOut: Database["public"]["Tables"]["transactions"]["Insert"] = {
      user_id: userId,
      type: "transfer",
      flow_type: false,
      amount: sourceAmount,
      currency,
      account_id: values.account_id ?? null,
      destination_account_id: values.destination_account_id ?? null,
      destination_amount: destAmount,
      destination_currency: destCurrency,
      exchange_rate: values.exchange_rate ?? null,
      category_id: null,
      note: values.note?.trim() || null,
      transaction_time: txTime,
    };

    const { data: outData, error: outError } = await supabase
      .from("transactions")
      .insert(payloadOut)
      .select(TRANSACTION_SELECT)
      .single();

    if (outError || !outData) {
      return { data: null, error: outError };
    }

    // 2. Record 2: Inflow (destination account, flow_type: true = increase)
    const payloadIn: Database["public"]["Tables"]["transactions"]["Insert"] = {
      user_id: userId,
      type: "transfer",
      flow_type: true,
      transfer_peer_id: outData.id,
      amount: destAmount,
      currency: destCurrency,
      account_id: values.destination_account_id ?? null,
      destination_account_id: values.account_id ?? null,
      destination_amount: sourceAmount,
      destination_currency: currency,
      exchange_rate: values.exchange_rate ?? null,
      category_id: null,
      note: values.note?.trim() || null,
      transaction_time: txTime,
    };

    const { data: inData, error: inError } = await supabase
      .from("transactions")
      .insert(payloadIn)
      .select(TRANSACTION_SELECT)
      .single();

    if (inError || !inData) {
      return { data: outData as TransactionWithRelations, error: inError };
    }

    // Link back record 1 to record 2
    await supabase
      .from("transactions")
      .update({ transfer_peer_id: inData.id })
      .eq("id", outData.id)
      .eq("user_id", userId);

    // Update balances: deduct source account, add destination account
    if (values.account_id) {
      const { data: srcAcc } = await supabase
        .from("accounts")
        .select("balance")
        .eq("user_id", userId)
        .eq("id", values.account_id)
        .maybeSingle();
      if (srcAcc) {
        await supabase
          .from("accounts")
          .update({ balance: (Number(srcAcc.balance) || 0) - sourceAmount })
          .eq("user_id", userId)
          .eq("id", values.account_id);
      }
    }
    if (values.destination_account_id) {
      const { data: dstAcc } = await supabase
        .from("accounts")
        .select("balance")
        .eq("user_id", userId)
        .eq("id", values.destination_account_id)
        .maybeSingle();
      if (dstAcc) {
        await supabase
          .from("accounts")
          .update({ balance: (Number(dstAcc.balance) || 0) + destAmount })
          .eq("user_id", userId)
          .eq("id", values.destination_account_id);
      }
    }

    const outDataWithPeer = { ...outData, transfer_peer_id: inData.id };
    return { data: outDataWithPeer as TransactionWithRelations, peer: inData as TransactionWithRelations, error: null };
  }

  // Expense (flow_type = false) or Income (flow_type = true)
  const isIncome = values.type === "income";
  const payload: Database["public"]["Tables"]["transactions"]["Insert"] = {
    user_id: userId,
    type: isIncome ? "income" : "expense",
    flow_type: isIncome,
    amount: values.amount,
    account_id: values.account_id ?? null,
    destination_account_id: null,
    destination_amount: null,
    destination_currency: null,
    exchange_rate: null,
    category_id: values.category_id ?? null,
    currency,
    note: values.note?.trim() || null,
    transaction_time: txTime,
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select(TRANSACTION_SELECT)
    .single();

  if (!error && values.account_id) {
    const { data: acc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("user_id", userId)
      .eq("id", values.account_id)
      .maybeSingle();
    if (acc) {
      const delta = isIncome ? values.amount : -values.amount;
      await supabase
        .from("accounts")
        .update({ balance: (Number(acc.balance) || 0) + delta })
        .eq("user_id", userId)
        .eq("id", values.account_id);
    }
  }

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
  const txTime = values.transaction_time ? new Date(values.transaction_time).toISOString() : new Date().toISOString();

  // Fetch existing transaction to check for transfer_peer_id and current flow_type
  const { data: existing } = await supabase
    .from("transactions")
    .select("id, type, flow_type, transfer_peer_id")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();

  const isIncome = values.type === "income";
  const flowType = values.type === "transfer" ? (existing?.flow_type ?? false) : isIncome;

  const payload: Database["public"]["Tables"]["transactions"]["Update"] = {
    type: values.type ?? "expense",
    flow_type: flowType,
    amount: values.amount,
    account_id: values.account_id ?? null,
    destination_account_id: values.type === "transfer" ? (values.destination_account_id ?? null) : null,
    destination_amount: values.type === "transfer" ? (values.destination_amount ?? null) : null,
    destination_currency: values.type === "transfer" ? (values.destination_currency ?? null) : null,
    exchange_rate: values.type === "transfer" ? (values.exchange_rate ?? null) : null,
    category_id: values.type === "transfer" ? null : (values.category_id ?? null),
    currency,
    note: values.note?.trim() || null,
    transaction_time: txTime,
  };

  const { error } = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", transactionId)
    .eq("user_id", userId);

  if (error) return { error };

  // If this is a transfer and has a peer, synchronize peer record
  if (existing?.transfer_peer_id && values.type === "transfer") {
    const peerId = existing.transfer_peer_id;
    const isThisLegOutflow = !existing.flow_type;

    const peerPayload: Database["public"]["Tables"]["transactions"]["Update"] = {
      note: values.note?.trim() || null,
      transaction_time: txTime,
      exchange_rate: values.exchange_rate ?? null,
      account_id: isThisLegOutflow ? (values.destination_account_id ?? null) : (values.account_id ?? null),
      destination_account_id: isThisLegOutflow ? (values.account_id ?? null) : (values.destination_account_id ?? null),
      amount: isThisLegOutflow ? (values.destination_amount ?? values.amount) : values.amount,
      currency: isThisLegOutflow ? (values.destination_currency ?? currency) : (values.currency ?? currency),
      destination_amount: isThisLegOutflow ? values.amount : (values.destination_amount ?? values.amount),
      destination_currency: isThisLegOutflow ? currency : (values.destination_currency ?? currency),
    };

    await supabase
      .from("transactions")
      .update(peerPayload)
      .eq("id", peerId)
      .eq("user_id", userId);
  }

  return { error: null };
};
