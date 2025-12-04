import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { debtPaymentSchema } from "@/lib/validation/debts";

export const dynamic = "force-dynamic";

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

const computeOutstanding = (
  direction: "lend" | "borrow",
  principalAmount: number,
  payments: Array<{ payment_type: string; principal_amount: number | null; amount: number | null }>
) => {
  const paidPrincipal = payments.reduce((sum, p) => {
    const principal = p.principal_amount ?? p.amount ?? 0;
    if (direction === "borrow" && p.payment_type === "repayment") {
      return sum + Number(principal);
    }
    if (direction === "lend" && p.payment_type === "receive") {
      return sum + Number(principal);
    }
    return sum;
  }, 0);

  const remaining = Number(principalAmount) - paidPrincipal;
  return remaining < 0 ? 0 : remaining;
};

export async function POST(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = debtPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const data = parsed.data;
  const now = new Date();

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("id,user_id,principal_amount,direction,currency,status")
    .eq("id", data.debt_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (debtError) return NextResponse.json({ error: debtError.message }, { status: 500 });
  if (!debt) return NextResponse.json({ error: "Debt not found" }, { status: 404 });

  let resolvedCurrency = data.currency?.trim() || debt.currency;
  if (!resolvedCurrency && data.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("currency")
      .eq("user_id", user.id)
      .eq("id", data.account_id)
      .maybeSingle();
    if (account?.currency) resolvedCurrency = account.currency;
  }
  const currency = resolvedCurrency || "VND";

  const paymentType = debt.direction === "borrow" ? "repayment" : "receive";
  const transactionType = debt.direction === "borrow" ? "expense" : "income";
  const transaction_time = parseDateToIso(data.payment_date, now);

  const transactionPayload = {
    user_id: user.id,
    account_id: data.account_id ?? null,
    category_id: data.category_id ?? null,
    type: transactionType,
    amount: data.amount,
    currency,
    note: data.note?.trim() || null,
    transaction_time,
  };

  const { data: insertedTx, error: txError } = await supabase
    .from("transactions")
    .insert(transactionPayload)
    .select("id")
    .single();

  if (txError || !insertedTx?.id) {
    return NextResponse.json({ error: txError?.message ?? "Failed to create transaction" }, { status: 500 });
  }

  const paymentPayload = {
    user_id: user.id,
    debt_id: debt.id,
    transaction_id: insertedTx.id,
    payment_type: paymentType as "repayment" | "receive",
    amount: data.amount,
    principal_amount: data.principal_amount ?? data.amount,
    interest_amount: data.interest_amount ?? null,
    payment_date: transaction_time,
    note: data.note?.trim() || null,
  };

  const { error: paymentError } = await supabase.from("debt_payments").insert(paymentPayload);
  if (paymentError) {
    await supabase.from("transactions").delete().eq("id", insertedTx.id).eq("user_id", user.id);
    return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }

  const { data: paymentRows, error: sumError } = await supabase
    .from("debt_payments")
    .select("payment_type,principal_amount,amount")
    .eq("debt_id", debt.id)
    .eq("user_id", user.id);

  if (sumError) {
    return NextResponse.json({ error: sumError.message }, { status: 500 });
  }

  const remaining = computeOutstanding(debt.direction as "lend" | "borrow", debt.principal_amount, paymentRows ?? []);
  const newStatus = remaining <= 0 ? "paid_off" : "ongoing";

  await supabase
    .from("debts")
    .update({ status: newStatus, updated_at: now.toISOString() })
    .eq("id", debt.id)
    .eq("user_id", user.id);

  return NextResponse.json({ success: true, remaining_principal: remaining });
}
