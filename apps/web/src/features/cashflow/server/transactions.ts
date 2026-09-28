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

export const adjustAccountBalance = async (
  supabase: Supabase,
  userId: string,
  accountId: string | null | undefined,
  delta: number
) => {
  if (!accountId || delta === 0) return;
  const { data: acc } = await supabase
    .from("accounts")
    .select("balance")
    .eq("user_id", userId)
    .eq("id", accountId)
    .maybeSingle();
  if (acc) {
    await supabase
      .from("accounts")
      .update({ balance: (Number(acc.balance) || 0) + delta })
      .eq("user_id", userId)
      .eq("id", accountId);
  }
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

  // Fetch existing transaction
  const { data: existing } = await supabase
    .from("transactions")
    .select("id, type, flow_type, transfer_peer_id, amount, account_id, destination_account_id, destination_amount, destination_currency")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    return { error: { message: "Transaction not found", details: "", hint: "", code: "404" } as PostgrestError };
  }

  // Type cannot be changed after creation
  const type = existing.type;

  if (type === "transfer") {
    let peer = null;
    if (existing.transfer_peer_id) {
      const { data: peerData } = await supabase
        .from("transactions")
        .select("id, type, flow_type, transfer_peer_id, amount, account_id, destination_account_id, destination_amount, destination_currency")
        .eq("id", existing.transfer_peer_id)
        .eq("user_id", userId)
        .maybeSingle();
      peer = peerData;
    }

    const outflow = existing.flow_type === false ? existing : peer;
    const inflow = existing.flow_type === true ? existing : peer;

    const oldSourceAccId = outflow?.account_id;
    const oldSourceAmount = Number(outflow?.amount) || 0;
    const oldDestAccId = inflow?.account_id ?? outflow?.destination_account_id;
    const oldDestAmount = Number(inflow?.amount ?? outflow?.destination_amount ?? outflow?.amount ?? 0);

    const newSourceAccId = values.account_id ?? null;
    const newSourceAmount = Number(values.amount) || 0;
    const newDestAccId = values.destination_account_id ?? null;
    const newDestAmount = Number(values.destination_amount ?? values.amount ?? 0);
    const newDestCurrency = values.destination_currency || currency;

    // 1. Revert old transfer balances
    if (oldSourceAccId) {
      await adjustAccountBalance(supabase, userId, oldSourceAccId, +oldSourceAmount);
    }
    if (oldDestAccId) {
      await adjustAccountBalance(supabase, userId, oldDestAccId, -oldDestAmount);
    }

    // 2. Apply new transfer balances
    if (newSourceAccId) {
      await adjustAccountBalance(supabase, userId, newSourceAccId, -newSourceAmount);
    }
    if (newDestAccId) {
      await adjustAccountBalance(supabase, userId, newDestAccId, +newDestAmount);
    }

    // 3. Update outflow record
    if (outflow) {
      await supabase
        .from("transactions")
        .update({
          amount: newSourceAmount,
          currency,
          account_id: newSourceAccId,
          destination_account_id: newDestAccId,
          destination_amount: newDestAmount,
          destination_currency: newDestCurrency,
          exchange_rate: values.exchange_rate ?? null,
          note: values.note?.trim() || null,
          transaction_time: txTime,
        })
        .eq("id", outflow.id)
        .eq("user_id", userId);
    }

    // 4. Update inflow record
    if (inflow) {
      await supabase
        .from("transactions")
        .update({
          amount: newDestAmount,
          currency: newDestCurrency,
          account_id: newDestAccId,
          destination_account_id: newSourceAccId,
          destination_amount: newSourceAmount,
          destination_currency: currency,
          exchange_rate: values.exchange_rate ?? null,
          note: values.note?.trim() || null,
          transaction_time: txTime,
        })
        .eq("id", inflow.id)
        .eq("user_id", userId);
    }

    return { error: null };
  }

  // Expense or Income
  const isIncome = type === "income";
  const oldAccId = existing.account_id;
  const oldAmount = Number(existing.amount) || 0;
  const newAccId = values.account_id ?? null;
  const newAmount = Number(values.amount) || 0;

  // 1. Revert old balance
  if (oldAccId) {
    await adjustAccountBalance(supabase, userId, oldAccId, isIncome ? -oldAmount : +oldAmount);
  }

  // 2. Apply new balance
  if (newAccId) {
    await adjustAccountBalance(supabase, userId, newAccId, isIncome ? +newAmount : -newAmount);
  }

  // 3. Update transaction record
  const { error } = await supabase
    .from("transactions")
    .update({
      amount: newAmount,
      currency,
      account_id: newAccId,
      category_id: values.category_id ?? null,
      note: values.note?.trim() || null,
      transaction_time: txTime,
    })
    .eq("id", transactionId)
    .eq("user_id", userId);

  return { error };
};
