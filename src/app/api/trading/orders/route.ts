import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { orderFormSchema } from "@/lib/validation/trading";

export const dynamic = "force-dynamic";

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

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
  const symbol = searchParams.get("symbol");
  const status = searchParams.get("status");

  let query = supabase.from("trading_orders").select("*").eq("user_id", user.id);

  if (symbol) {
    query = query.ilike("symbol", `%${symbol}%`);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("open_time", { ascending: false });

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
  const parsed = orderFormSchema.safeParse({
    ...body,
    entry_price: parseNumber(body.entry_price),
    sl_price: parseNumber(body.sl_price),
    tp_price: parseNumber(body.tp_price),
    volume: parseNumber(body.volume),
    leverage: parseNumber(body.leverage),
    original_position_size: parseNumber(body.original_position_size),
    commission_usd: parseNumber(body.commission_usd),
    swap_usd: parseNumber(body.swap_usd),
    equity_usd: parseNumber(body.equity_usd),
    margin_level: parseNumber(body.margin_level),
    close_price: parseNumber(body.close_price),
    pnl_amount: parseNumber(body.pnl_amount),
    pnl_percent: parseNumber(body.pnl_percent),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload = {
    ...parsed.data,
    status: parsed.data.status ?? "open",
    open_time: new Date(parsed.data.open_time).toISOString(),
    close_time: parsed.data.close_time ? new Date(parsed.data.close_time).toISOString() : null,
    sl_price: parsed.data.sl_price ?? null,
    tp_price: parsed.data.tp_price ?? null,
    leverage: parsed.data.leverage ?? null,
    ticket: parsed.data.ticket?.trim() || null,
    original_position_size: parsed.data.original_position_size ?? null,
    commission_usd: parsed.data.commission_usd ?? null,
    swap_usd: parsed.data.swap_usd ?? null,
    equity_usd: parsed.data.equity_usd ?? null,
    margin_level: parsed.data.margin_level ?? null,
    close_price: parsed.data.close_price ?? null,
    pnl_amount: parsed.data.pnl_amount ?? null,
    pnl_percent: parsed.data.pnl_percent ?? null,
    close_reason: parsed.data.close_reason?.trim() || null,
    note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
    user_id: user.id,
  };

  const { error } = await supabase.from("trading_orders").insert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body.id) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

   // Prevent updates to imported orders
  const { data: existingOrder, error: fetchError } = await supabase
    .from("trading_orders")
    .select("is_imported")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (existingOrder?.is_imported) {
    return NextResponse.json({ error: "Imported orders cannot be edited" }, { status: 403 });
  }

  const parsed = orderFormSchema.safeParse({
    ...body,
    entry_price: parseNumber(body.entry_price),
    sl_price: parseNumber(body.sl_price),
    tp_price: parseNumber(body.tp_price),
    volume: parseNumber(body.volume),
    leverage: parseNumber(body.leverage),
    original_position_size: parseNumber(body.original_position_size),
    commission_usd: parseNumber(body.commission_usd),
    swap_usd: parseNumber(body.swap_usd),
    equity_usd: parseNumber(body.equity_usd),
    margin_level: parseNumber(body.margin_level),
    close_price: parseNumber(body.close_price),
    pnl_amount: parseNumber(body.pnl_amount),
    pnl_percent: parseNumber(body.pnl_percent),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload = {
    ...parsed.data,
    status: parsed.data.status ?? "open",
    open_time: new Date(parsed.data.open_time).toISOString(),
    close_time: parsed.data.close_time ? new Date(parsed.data.close_time).toISOString() : null,
    sl_price: parsed.data.sl_price ?? null,
    tp_price: parsed.data.tp_price ?? null,
    leverage: parsed.data.leverage ?? null,
    ticket: parsed.data.ticket?.trim() || null,
    original_position_size: parsed.data.original_position_size ?? null,
    commission_usd: parsed.data.commission_usd ?? null,
    swap_usd: parsed.data.swap_usd ?? null,
    equity_usd: parsed.data.equity_usd ?? null,
    margin_level: parsed.data.margin_level ?? null,
    close_price: parsed.data.close_price ?? null,
    pnl_amount: parsed.data.pnl_amount ?? null,
    pnl_percent: parsed.data.pnl_percent ?? null,
    close_reason: parsed.data.close_reason?.trim() || null,
    note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
  };

  const { error } = await supabase
    .from("trading_orders")
    .update(payload)
    .eq("id", body.id)
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
  if (!body.id) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  // Prevent deletes for imported rows
  const { data: existingOrder, error: fetchError } = await supabase
    .from("trading_orders")
    .select("is_imported")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single();
  if (fetchError && fetchError.code !== "PGRST116") {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (existingOrder?.is_imported) {
    return NextResponse.json({ error: "Imported orders cannot be deleted" }, { status: 403 });
  }

  const { error } = await supabase.from("trading_orders").delete().eq("id", body.id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
