import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BalanceLedgerService } from "@/lib/trading/ledger";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
type OrderRow = Database["public"]["Tables"]["trading_orders"]["Row"];

export async function POST() {
  try {
    const supabase = await createClient(); // Server-side Supabase client
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    // Reject if unauthenticated
    if (error || !user) {
      console.error("sync-ledger auth error", error);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load up to 500 closed orders with a linked balance account, oldest close_time first.
    const { data: orders, error: ordersError } = await supabase
      .from("trading_orders")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "closed")
      .not("balance_account_id", "is", null)
      .order("close_time", { ascending: true })
      .limit(500);

    // Handle query error
    if (ordersError) {
      console.error("sync-ledger fetch orders error", ordersError);
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    // Extract order ids; short-circuit if none
    const orderRows: OrderRow[] = (orders ?? []) as OrderRow[];
    const orderIds = orderRows.map((o) => o.id);
    if (!orderIds.length) {
      return NextResponse.json({ synced: 0, skipped: 0, message: "No closed orders to sync" });
    }

    // Fetch existing ledger refs in small batches to avoid "URI too long" errors on IN queries.
    const chunk = <T,>(arr: T[], size: number) => {
      const result: T[][] = [];
      for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
      return result;
    };
    const existingSet = new Set<string>();
    for (const idChunk of chunk(orderIds, 80)) {
      // Only care about ledger entries with source_ref_id matching a trade (TRADE_PNL)
      const { data: existingLedger, error: ledgerError } = await supabase
        .from("trading_balance_ledger")
        .select("source_ref_id")
        .eq("source_type", "TRADE_PNL")
        .in("source_ref_id", idChunk);

      // Bail out on query errors
      if (ledgerError) {
        console.error("sync-ledger fetch ledger error", ledgerError);
        return NextResponse.json({ error: ledgerError.message }, { status: 500 });
      }
      // Track already-synced orders
      (existingLedger ?? []).forEach((r) => {
        if (r.source_ref_id) existingSet.add(r.source_ref_id);
      });
    }
    // Orders not yet in ledger
    const toSync = orderRows.filter((o) => !existingSet.has(o.id));

    // Nothing to do? Return early
    if (!toSync.length) {
      return NextResponse.json({ synced: 0, skipped: orderRows.length, message: "All closed orders already in ledger" });
    }

    // Build account lookup to validate ownership/type and pull currency.
    const balanceIds = Array.from(new Set(toSync.map((o) => o.balance_account_id).filter(Boolean))) as string[];
    const { data: balanceAccounts, error: balancesError } = await supabase
      .from("balance_accounts")
      .select("id,currency,user_id,account_type")
      .in("id", balanceIds);
    // Error fetching balance accounts
    if (balancesError) {
      console.error("sync-ledger fetch balances error", balancesError);
      return NextResponse.json({ error: balancesError.message }, { status: 500 });
    }
    // Map of balance_account_id -> metadata
    const balanceMap = new Map<string, { currency: string; user_id: string; account_type: string }>();
    (balanceAccounts ?? []).forEach((ba) => {
      if (ba.id) balanceMap.set(ba.id, { currency: ba.currency, user_id: ba.user_id, account_type: ba.account_type });
    });

    // Create ledger helper
    const ledger = new BalanceLedgerService(supabase as any);
    let synced = 0;
    for (const order of toSync) {
      // Only write ledger entries when the balance belongs to user and is TRADING.
      const balanceInfo = order.balance_account_id ? balanceMap.get(order.balance_account_id) : null;
      if (!balanceInfo || balanceInfo.user_id !== user.id || balanceInfo.account_type !== "TRADING") {
        continue;
      }
      try {
        // Append trade PnL + commission/swap to ledger
        await ledger.recordTradeSettlement({
          balanceAccountId: order.balance_account_id!,
          orderId: order.id,
          grossPnl: Number(order.pnl_amount ?? 0),
          commission: Number(order.commission_usd ?? 0),
          swap: Number(order.swap_usd ?? 0),
          closeTime: order.close_time ?? order.open_time,
          currency: balanceInfo.currency ?? "USD",
        });
        synced += 1;
      } catch (err: any) {
        // Fail fast if a ledger write fails; return partial count
        console.error("sync-ledger write error", { orderId: order.id, balanceAccountId: order.balance_account_id, error: err });
        return NextResponse.json({ error: err?.message ?? "Ledger write failed", synced }, { status: 500 });
      }
    }

    // Recompute running balances for affected accounts to keep balance_after consistent when backfilling.
    for (const balanceId of balanceIds) {
      try {
        await ledger.recomputeRunningBalances(balanceId);
      } catch (err: any) {
        // Fail fast if recompute fails; return partial count
        console.error("sync-ledger recompute error", { balanceId, error: err });
        return NextResponse.json({ error: err?.message ?? "Recompute failed", synced }, { status: 500 });
      }
    }

    // Return sync stats
    return NextResponse.json({ synced, skipped: orderRows.length - synced });
  } catch (err: any) {
    // Unhandled errors bubble here
    console.error("sync-ledger fatal error", err);
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
  }
}
