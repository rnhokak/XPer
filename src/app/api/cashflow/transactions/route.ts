import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cashflowQuickAddSchema } from "@/lib/validation/cashflow";
import { normalizeCashflowRange, rangeStart } from "@/lib/cashflow/utils";
import { createCashflowTransaction, updateCashflowTransaction } from "@/features/cashflow/server/transactions";

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

  const { data: inserted, error } = await createCashflowTransaction({
    supabase,
    userId: user.id,
    values: parsed.data,
  });

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

  const { error } = await updateCashflowTransaction({
    supabase,
    userId: user.id,
    transactionId: id,
    values: parsed.data,
  });

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
