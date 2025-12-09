import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

const importRowSchema = z.object({
  ticket: z.string().optional().nullable(),
  symbol: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  entry_price: z.number().positive(),
  sl_price: z.number().optional().nullable(),
  tp_price: z.number().optional().nullable(),
  volume: z.number().positive(),
  leverage: z.number().int().positive().optional().nullable(),
  original_position_size: z.number().optional().nullable(),
  commission_usd: z.number().optional().nullable(),
  swap_usd: z.number().optional().nullable(),
  equity_usd: z.number().optional().nullable(),
  margin_level: z.number().optional().nullable(),
  close_reason: z.string().optional().nullable(),
  status: z.enum(["open", "closed", "cancelled"]),
  open_time: z.string().min(1),
  close_time: z.string().optional().nullable(),
  close_price: z.number().optional().nullable(),
  pnl_amount: z.number().optional().nullable(),
  pnl_percent: z.number().optional().nullable(),
  note: z.string().optional().nullable(),
  balance_account_id: z.string().uuid(),
});

const importPayloadSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(500),
});

const getUserAndClient = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
};

const loadBalanceCurrencies = async (supabase: Awaited<ReturnType<typeof createClient>>, balanceAccountIds: string[]) => {
  const { data, error } = await supabase
    .from("balance_accounts")
    .select("id,currency,user_id,account_type")
    .in("id", balanceAccountIds);
  if (error) throw new Error(error.message);
  const map = new Map<string, { currency: string; user_id: string; account_type: string }>();
  (data ?? []).forEach((row) => {
    if (row.id) map.set(row.id, { currency: row.currency, user_id: row.user_id, account_type: row.account_type });
  });
  return map;
};

export async function POST(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = importPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const rows = parsed.data.rows.map((row) => {
    const openTime = new Date(row.open_time);
    const closeTime = row.close_time ? new Date(row.close_time) : null;
    const status = row.status;

    return {
      is_imported: true,
      ticket: row.ticket?.trim() || null,
      symbol: row.symbol,
      side: row.side,
      entry_price: row.entry_price,
      sl_price: row.sl_price ?? null,
      tp_price: row.tp_price ?? null,
      volume: row.volume,
      leverage: row.leverage ?? null,
      original_position_size: row.original_position_size ?? null,
      commission_usd: row.commission_usd ?? null,
      swap_usd: row.swap_usd ?? null,
      equity_usd: row.equity_usd ?? null,
      margin_level: row.margin_level ?? null,
      close_reason: row.close_reason?.trim() || null,
      status,
      open_time: isNaN(openTime.getTime()) ? new Date().toISOString() : openTime.toISOString(),
      close_time: closeTime && !isNaN(closeTime.getTime()) ? closeTime.toISOString() : null,
      close_price: row.close_price ?? null,
      pnl_amount: row.pnl_amount ?? null,
      pnl_percent: row.pnl_percent ?? null,
      note: row.note?.trim() ? row.note.trim() : null,
      user_id: user.id,
      balance_account_id: row.balance_account_id,
    };
  });

// Validate balance_account_id ownership/type
const balanceIdsInput = Array.from(new Set(rows.map((r) => r.balance_account_id)));
const balanceMap = await loadBalanceCurrencies(supabase, balanceIdsInput);
for (const row of rows) {
  const acc = balanceMap.get(row.balance_account_id);
  if (!acc) {
    return NextResponse.json({ error: "Balance account not found" }, { status: 400 });
  }
  if (acc.user_id !== user.id || acc.account_type !== "TRADING") {
    return NextResponse.json({ error: "Balance account not owned by user or not TRADING type" }, { status: 400 });
  }
}

  // Skip rows with duplicate tickets for this user
  const tickets = rows.map((r) => r.ticket).filter((t): t is string => Boolean(t));
  let existingTickets: string[] = [];
  if (tickets.length) {
    const { data: existing, error: existingError } = await supabase
      .from("trading_orders")
      .select("ticket")
      .eq("user_id", user.id)
      .in("ticket", tickets);
    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    const existingRows: Array<{ ticket: string | null }> = existing ?? [];
    existingTickets = existingRows.map((r) => r.ticket).filter((t): t is string => Boolean(t)) ?? [];
  }

  const filteredRows = rows.filter((row) => !row.ticket || !existingTickets.includes(row.ticket));

  if (filteredRows.length === 0) {
    return NextResponse.json({ success: true, count: 0, skipped: tickets.length, message: "All rows were duplicates" });
  }

  const { data: inserted, error } = await supabase.from("trading_orders").insert(filteredRows).select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: filteredRows.length, skipped: rows.length - filteredRows.length });
}
