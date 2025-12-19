import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { debtCreateSchema } from "@/lib/validation/debts";
import { type Database } from "@/lib/supabase/types";
import { createCashflowTransaction } from "@/features/cashflow/server/transactions";
import { type CashflowQuickAddValues } from "@/lib/validation/cashflow";

export const dynamic = "force-dynamic";
const debtStatuses = ["ongoing", "paid_off", "overdue", "cancelled"] as const;
type DebtStatus = (typeof debtStatuses)[number];
type DebtPayment = { debt_id: string; payment_type: string; principal_amount: number | null; amount: number | null };

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

const outstandingPrincipal = (
  debt: { principal_amount: number; direction: "lend" | "borrow" },
  payments: Array<{ payment_type: string; principal_amount: number | null; amount: number | null }>
) => {
  const reducer = payments.reduce((sum, payment) => {
    const principal = payment.principal_amount ?? payment.amount ?? 0;
    if (debt.direction === "borrow" && payment.payment_type === "repayment") {
      return sum + Number(principal);
    }
    if (debt.direction === "lend" && payment.payment_type === "receive") {
      return sum + Number(principal);
    }
    return sum;
  }, 0);

  const remaining = Number(debt.principal_amount) - reducer;
  return remaining < 0 ? 0 : remaining;
};

export async function GET(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const status = debtStatuses.includes(statusParam as DebtStatus) ? (statusParam as DebtStatus) : null;

  let debtQuery = supabase
    .from("debts")
    .select(
      "id,partner_id,direction,principal_amount,currency,start_date,due_date,interest_type,interest_rate,interest_cycle,status,description,created_at,updated_at,partner:partners(id,name,type,phone)"
    )
    .eq("user_id", user.id)
    .order("start_date", { ascending: false });

  if (status) {
    debtQuery = debtQuery.eq("status", status);
  }

  const [{ data: debts, error: debtsError }, { data: payments, error: paymentsError }] = await Promise.all([
    debtQuery,
    supabase
      .from("debt_payments")
      .select("debt_id,payment_type,principal_amount,amount")
      .eq("user_id", user.id),
  ]);

  if (debtsError || paymentsError) {
    const message = debtsError?.message ?? paymentsError?.message ?? "Failed to fetch debts";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const paymentMap = new Map<string, DebtPayment[]>();
  (payments ?? []).forEach((p: DebtPayment) => {
    const arr = paymentMap.get(p.debt_id) ?? [];
    arr.push(p);
    paymentMap.set(p.debt_id, arr);
  });

  const debtsData: Array<{ id: string; direction: "lend" | "borrow"; principal_amount: number } & Record<string, any>> =
    debts ?? [];

  const enriched = debtsData.map((debt) => {
    const related = paymentMap.get(debt.id) ?? [];
    return {
      ...debt,
      outstanding_principal: outstandingPrincipal(debt as any, related),
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = debtCreateSchema.safeParse(body);
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
  const currency = resolvedCurrency || "VND";

  const debtPayload = {
    user_id: user.id,
    partner_id: data.partner_id,
    direction: data.direction,
    principal_amount: data.principal_amount,
    currency,
    start_date: data.start_date,
    due_date: data.due_date ?? null,
    interest_type: data.interest_type ?? "none",
    interest_rate: data.interest_rate ?? null,
    interest_cycle: data.interest_cycle ?? null,
    status: "ongoing" as const,
    description: data.description?.trim() || null,
    updated_at: now.toISOString(),
  };

  const { data: insertedDebt, error: debtError } = await supabase.from("debts").insert(debtPayload).select("id").single();
  if (debtError || !insertedDebt?.id) {
    return NextResponse.json({ error: debtError?.message ?? "Failed to create debt" }, { status: 500 });
  }

  const transactionType: "income" | "expense" = data.direction === "borrow" ? "income" : "expense";

  const transactionValues: CashflowQuickAddValues = {
    type: transactionType,
    amount: data.principal_amount,
    account_id: data.account_id ?? null,
    category_id: data.category_id ?? null,
    currency,
    note: data.note ?? undefined,
    transaction_time: parseDateToIso(data.transaction_time ?? data.start_date, now),
  };

  const { data: insertedTx, error: txError } = await createCashflowTransaction({
    supabase,
    userId: user.id,
    values: transactionValues,
  });

  if (txError || !insertedTx?.id) {
    await supabase.from("debts").delete().eq("id", insertedDebt.id).eq("user_id", user.id);
    return NextResponse.json({ error: txError?.message ?? "Failed to create cashflow transaction" }, { status: 500 });
  }

  const paymentPayload = {
    user_id: user.id,
    debt_id: insertedDebt.id,
    transaction_id: insertedTx.id,
    payment_type: "disbursement" as const,
    amount: data.principal_amount,
    principal_amount: data.principal_amount,
    interest_amount: null,
    payment_date: transactionValues.transaction_time ?? now.toISOString(),
    note: data.note?.trim() || null,
  };

  const { error: paymentError } = await supabase.from("debt_payments").insert(paymentPayload);
  if (paymentError) {
    await supabase.from("transactions").delete().eq("id", insertedTx.id).eq("user_id", user.id);
    await supabase.from("debts").delete().eq("id", insertedDebt.id).eq("user_id", user.id);
    return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, debt_id: insertedDebt.id });
}
