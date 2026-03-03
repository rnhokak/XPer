import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const debtId = id;
  if (!debtId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const debtPromise = supabase
    .from("debts")
    .select(
      "id,partner_id,direction,principal_amount,currency,start_date,due_date,status,description,interest_type,interest_rate,interest_cycle,created_at,updated_at,partner:partners(id,name,type,phone,note)"
    )
    .eq("id", debtId)
    .eq("user_id", user.id)
    .maybeSingle();

  const paymentsPromise = supabase
    .from("debt_payments")
    .select(
      "id,payment_type,amount,principal_amount,interest_amount,payment_date,note,transaction:transactions(id,type,amount,currency,transaction_time,note,account:accounts(id,name,currency),category:categories(id,name,type))"
    )
    .eq("debt_id", debtId)
    .eq("user_id", user.id)
    .order("payment_date", { ascending: false });

  const accountsPromise = supabase
    .from("accounts")
    .select("id,name,type,currency,is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false });

  const categoriesPromise = supabase
    .from("categories")
    .select("id,name,type,parent_id,level,category_focus,is_default")
    .eq("user_id", user.id);

  const [{ data: debt, error: debtError }, { data: payments, error: paymentsError }, accountsRes, categoriesRes] = await Promise.all([
    debtPromise,
    paymentsPromise,
    accountsPromise,
    categoriesPromise,
  ]);

  if (debtError) return NextResponse.json({ error: debtError.message }, { status: 500 });
  if (!debt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 });
  if (accountsRes.error) return NextResponse.json({ error: accountsRes.error.message }, { status: 500 });
  if (categoriesRes.error) return NextResponse.json({ error: categoriesRes.error.message }, { status: 500 });

  return NextResponse.json({
    debt,
    payments: payments ?? [],
    accounts: accountsRes.data ?? [],
    categories: categoriesRes.data ?? [],
  });
}
