import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cashflowQuickAddSchema } from "@/lib/validation/cashflow";
import { normalizeCashflowRange, rangeStart } from "@/lib/cashflow/utils";

export const dynamic = "force-dynamic";

const getUserAndClient = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
};

export async function GET(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = normalizeCashflowRange(searchParams.get("range"));
  const start = rangeStart(range === "all" ? null : range);

  let query = supabase
    .from("transactions")
    .select(
      "id,type,amount,currency,note,transaction_time,category:categories(id,name,type),account:accounts(id,name,currency)"
    )
    .eq("user_id", user.id)
    .order("transaction_time", { ascending: false })
    .limit(50);

  if (start) {
    query = query.gte("transaction_time", start.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = cashflowQuickAddSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = parsed.data;
  let resolvedCurrency = data.currency?.trim() || null;

  if (!resolvedCurrency && data.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("currency")
      .eq("user_id", user.id)
      .eq("id", data.account_id)
      .maybeSingle();
    if (account?.currency) {
      resolvedCurrency = account.currency;
    }
  }

  const payload = {
    user_id: user.id,
    type: data.type ?? "expense",
    amount: data.amount,
    account_id: data.account_id ?? null,
    category_id: data.category_id ?? null,
    currency: resolvedCurrency || "USD",
    note: data.note?.trim() || null,
    transaction_time: data.transaction_time ? new Date(data.transaction_time).toISOString() : new Date().toISOString(),
  };

  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select("id,type,amount,currency,note,transaction_time,category:categories(id,name,type),account:accounts(id,name,currency)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(inserted);
}

export async function PUT(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const parsed = cashflowQuickAddSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = parsed.data;
  let resolvedCurrency = data.currency?.trim() || null;

  if (!resolvedCurrency && data.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("currency")
      .eq("user_id", user.id)
      .eq("id", data.account_id)
      .maybeSingle();
    if (account?.currency) {
      resolvedCurrency = account.currency;
    }
  }

  const payload = {
    type: data.type ?? "expense",
    amount: data.amount,
    account_id: data.account_id ?? null,
    category_id: data.category_id ?? null,
    currency: resolvedCurrency || "USD",
    note: data.note?.trim() || null,
    transaction_time: data.transaction_time ? new Date(data.transaction_time).toISOString() : new Date().toISOString(),
  };

  const { error } = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
