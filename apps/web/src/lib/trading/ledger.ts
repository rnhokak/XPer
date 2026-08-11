import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Json } from "@/lib/supabase/types";

type Tables = Database["public"]["Tables"];
type LedgerRow = Tables["trading_balance_ledger"]["Row"];
type LedgerInsert = Tables["trading_balance_ledger"]["Insert"];
type LedgerSourceType = LedgerRow["source_type"];

export type LedgerEntryInput = {
  balanceAccountId: string;
  amount: number;
  sourceType: LedgerSourceType;
  currency: string;
  occurredAt?: string | Date;
  sourceRefId?: string | null;
  meta?: Json;
};

export type TradeSettlementInput = {
  balanceAccountId: string;
  orderId: string;
  grossPnl: number;
  commission: number;
  swap: number;
  closeTime: string | Date;
  currency: string;
};

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

export class BalanceLedgerService {
  constructor(private supabase: SupabaseClient<Database>) {}

  private normalizeDate(input?: string | Date) {
    if (!input) return new Date().toISOString();
    return input instanceof Date ? input.toISOString() : new Date(input).toISOString();
  }

  async appendEntries(rawEntries: LedgerEntryInput[]) {
    if (!rawEntries.length) return { inserted: [] as LedgerInsert[] };

    const grouped = new Map<string, LedgerEntryInput[]>();
    rawEntries.forEach((entry) => {
      const current = grouped.get(entry.balanceAccountId) ?? [];
      current.push(entry);
      grouped.set(entry.balanceAccountId, current);
    });

    const prepared: LedgerInsert[] = [];

    for (const [balanceAccountId, entries] of grouped.entries()) {
      const normalized = entries.map((entry) => ({
        ...entry,
        occurredAtIso: this.normalizeDate(entry.occurredAt),
      }));

      // Find the balance right before the earliest occurred_at so running sums are consistent when backfilling.
      const earliestOccurred = normalized.reduce((min, e) => {
        const time = new Date(e.occurredAtIso).getTime();
        return time < min ? time : min;
      }, Number.POSITIVE_INFINITY);

      let running = 0;

      normalized
        .slice()
        .sort((a, b) => {
          const aTime = new Date(a.occurredAtIso).getTime();
          const bTime = new Date(b.occurredAtIso).getTime();
          if (aTime !== bTime) return aTime - bTime;
          // deterministic tie-breaker
          return String(a.sourceRefId ?? "").localeCompare(String(b.sourceRefId ?? ""));
        })
        .forEach((entry) => {
          const occurredAtIso = entry.occurredAtIso;
          running = running + Number(entry.amount);
          prepared.push({
            balance_account_id: balanceAccountId,
            source_type: entry.sourceType,
            source_ref_id: entry.sourceRefId ?? null,
            amount: Number(entry.amount),
            balance_after: running,
            occurred_at: occurredAtIso,
            created_at: occurredAtIso,
            currency: entry.currency,
            meta: entry.meta ?? {},
          });
        });
    }

    const { data, error } = await this.supabase.from("trading_balance_ledger").insert(prepared).select();
    if (error) {
      throw new Error(`Failed to append ledger entries: ${error.message}`);
    }

    // After inserting, recompute balances from 0 so debits (negative) and credits (positive) sum correctly.
    for (const balanceAccountId of grouped.keys()) {
      await this.recomputeRunningBalances(balanceAccountId);
    }

    return { inserted: data ?? prepared };
  }

  async recordDeposit(params: {
    balanceAccountId: string;
    amount: number;
    currency: string;
    occurredAt?: string | Date;
    sourceRefId?: string;
  }) {
    return this.appendEntries([
      {
        balanceAccountId: params.balanceAccountId,
        amount: Math.abs(params.amount),
        sourceType: "DEPOSIT",
        currency: params.currency,
        occurredAt: params.occurredAt,
        sourceRefId: params.sourceRefId,
      },
    ]);
  }

  async recordWithdraw(params: {
    balanceAccountId: string;
    amount: number;
    currency: string;
    occurredAt?: string | Date;
    sourceRefId?: string;
  }) {
    return this.appendEntries([
      {
        balanceAccountId: params.balanceAccountId,
        amount: -Math.abs(params.amount),
        sourceType: "WITHDRAW",
        currency: params.currency,
        occurredAt: params.occurredAt,
        sourceRefId: params.sourceRefId,
      },
    ]);
  }

  async recordTransfer(params: {
    fromBalanceAccountId: string;
    toBalanceAccountId: string;
    amount: number;
    currency: string;
    occurredAt?: string | Date;
    sourceRefId?: string;
    meta?: Json;
  }) {
    const occurredAt = params.occurredAt ?? new Date();
    const meta = params.meta ?? {};

    return this.appendEntries([
      {
        balanceAccountId: params.fromBalanceAccountId,
        amount: -Math.abs(params.amount),
        sourceType: "TRANSFER_OUT",
        currency: params.currency,
        occurredAt,
        sourceRefId: params.sourceRefId,
        meta,
      },
      {
        balanceAccountId: params.toBalanceAccountId,
        amount: Math.abs(params.amount),
        sourceType: "TRANSFER_IN",
        currency: params.currency,
        occurredAt,
        sourceRefId: params.sourceRefId,
        meta,
      },
    ]);
  }

  async recordTradeSettlement(params: TradeSettlementInput) {
    const occurredAt = params.closeTime;
    const entries: LedgerEntryInput[] = [
      {
        balanceAccountId: params.balanceAccountId,
        amount: Number(params.grossPnl),
        sourceType: "TRADE_PNL",
        currency: params.currency,
        occurredAt,
        sourceRefId: params.orderId,
      },
    ];

    if (params.commission) {
      entries.push({
        balanceAccountId: params.balanceAccountId,
        amount: -Math.abs(params.commission),
        sourceType: "COMMISSION",
        currency: params.currency,
        occurredAt,
        sourceRefId: params.orderId,
      });
    }

    if (params.swap) {
      entries.push({
        balanceAccountId: params.balanceAccountId,
        amount: -Math.abs(params.swap),
        sourceType: "SWAP",
        currency: params.currency,
        occurredAt,
        sourceRefId: params.orderId,
      });
    }

    return this.appendEntries(entries);
  }

  async recomputeDailySnapshot(balanceAccountId: string, date: string | Date) {
    const target = date instanceof Date ? date : new Date(date);
    target.setHours(0, 0, 0, 0);
    const start = target.toISOString();
    const endDate = new Date(target);
    endDate.setDate(target.getDate() + 1);
    const end = endDate.toISOString();

    const { data: dayEntries, error: dayErr } = await this.supabase
      .from("trading_balance_ledger")
      .select("*")
      .eq("balance_account_id", balanceAccountId)
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .order("occurred_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (dayErr) {
      throw new Error(`Failed to load ledger entries for snapshot: ${dayErr.message}`);
    }

    const { data: openingRow, error: openingErr } = await this.supabase
      .from("trading_balance_ledger")
      .select("balance_after")
      .eq("balance_account_id", balanceAccountId)
      .lt("occurred_at", start)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openingErr) {
      throw new Error(`Failed to load opening balance for snapshot: ${openingErr.message}`);
    }

    const dayEntriesList: LedgerRow[] = (dayEntries ?? []) as LedgerRow[];
    const openingBalance = Number((openingRow as LedgerRow | null)?.balance_after ?? 0);
    const closingBalance = dayEntriesList.length
      ? Number(dayEntriesList[dayEntriesList.length - 1].balance_after)
      : openingBalance;

    const sumByType = (types: LedgerSourceType[]) =>
      dayEntriesList
        .filter((entry) => types.includes(entry.source_type))
        .reduce((sum, entry) => sum + Number(entry.amount), 0);

    const depositAmount = sumByType(["DEPOSIT"]);
    const withdrawAmount = -sumByType(["WITHDRAW"]);
    const transferInAmount = sumByType(["TRANSFER_IN"]);
    const transferOutAmount = -sumByType(["TRANSFER_OUT"]);
    const tradingNetResult = sumByType(["TRADE_PNL", "COMMISSION", "SWAP"]);
    const adjustmentAmount = sumByType(["ADJUSTMENT", "BONUS", "BONUS_REMOVAL"]);

    const snapshot: Tables["trading_daily_balance_snapshots"]["Insert"] = {
      balance_account_id: balanceAccountId,
      date: dateOnly(target),
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      net_change: closingBalance - openingBalance,
      deposit_amount: depositAmount,
      withdraw_amount: withdrawAmount,
      transfer_in_amount: transferInAmount,
      transfer_out_amount: transferOutAmount,
      trading_net_result: tradingNetResult,
      adjustment_amount: adjustmentAmount,
      created_at: new Date().toISOString(),
    };

    const { error: upsertError } = await this.supabase
      .from("trading_daily_balance_snapshots")
      .upsert(snapshot, { onConflict: "balance_account_id,date" });

    if (upsertError) {
      throw new Error(`Failed to upsert daily snapshot: ${upsertError.message}`);
    }

    return snapshot;
  }

  // Recompute balance_after for the entire ledger of a balance account, anchoring to the current ending balance.
  async recomputeRunningBalances(balanceAccountId: string) {
    const { data, error } = await this.supabase
      .from("trading_balance_ledger")
      .select("id,amount,occurred_at,created_at,source_ref_id,balance_after")
      .eq("balance_account_id", balanceAccountId)
      .order("occurred_at", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      throw new Error(`Failed to load ledger for recompute: ${error.message}`);
    }

    const rows = data ?? [];
    if (!rows.length) return { updated: 0 };

    const updates = rows.map((row) => ({
      id: row.id,
      balance_after: 0, // placeholder
      amount: Number(row.amount ?? 0),
    }));

    // Current ending balance (from the latest row). Fallback to 0 if missing.
    const currentEndingBalance = Number(rows[rows.length - 1]?.balance_after ?? 0);
    const totalAmount = updates.reduce((sum, u) => sum + u.amount, 0);
    // Anchor starting balance so that the recomputed final balance equals the current ending balance.
    const startingBalance = currentEndingBalance - totalAmount;

    let running = startingBalance;
    updates.forEach((u) => {
      running += u.amount;
      u.balance_after = running;
    });

    for (const u of updates) {
      const { error: updateError } = await this.supabase
        .from("trading_balance_ledger")
        .update({ balance_after: u.balance_after })
        .eq("id", u.id);
      if (updateError) {
        throw new Error(`Failed to update balance_after for ${u.id}: ${updateError.message}`);
      }
    }

    return { updated: updates.length };
  }
}
