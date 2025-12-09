import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type LedgerRow = Database["public"]["Tables"]["trading_balance_ledger"]["Row"] & {
  balance_accounts?: {
    name?: string | null;
    account_type?: "TRADING" | "FUNDING";
    currency?: string | null;
  } | null;
};

const formatMoney = (value: number, currency: string) => {
  const safeCurrency = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: safeCurrency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${Number(value).toFixed(2)} ${safeCurrency}`;
  }
};

export default async function TradingLedgerPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trading_balance_ledger")
    .select(
      "id,balance_account_id,source_type,source_ref_id,amount,balance_after,occurred_at,created_at,currency,meta,balance_accounts(name,account_type,currency)"
    )
    .eq("balance_accounts.user_id", user.id)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: LedgerRow[] = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trading Balance Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Hiển thị 200 dòng gần nhất. Mỗi dòng là một biến động số dư (append-only).
        </p>
        {error ? <p className="mt-2 text-sm text-red-500">{error.message}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left font-semibold text-slate-700">#</th>
              <th className="px-3 py-3 text-left font-semibold text-slate-700">Date</th>
              <th className="px-3 py-3 text-left font-semibold text-slate-700">Source</th>
              <th className="px-3 py-3 text-right font-semibold text-slate-700">Amount</th>
              <th className="px-3 py-3 text-right font-semibold text-slate-700">Balance after</th>
              <th className="px-3 py-3 text-left font-semibold text-slate-700">Tài khoản</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Chưa có ledger nào.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const accountLabel = row.balance_accounts?.name ?? row.balance_account_id;
                const currency = row.balance_accounts?.currency ?? row.currency ?? "USD";
                const amount = Number(row.amount);
                const balanceAfter = Number(row.balance_after);
                return (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-3 text-xs text-muted-foreground">{idx}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <div className="font-medium">{new Date(row.occurred_at).toLocaleDateString()}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.created_at ? new Date(row.created_at).toLocaleTimeString() : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.source_type}</div>
                      <div className="text-xs text-muted-foreground">{row.source_ref_id ?? "—"}</div>
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-semibold ${
                        amount > 0 ? "text-emerald-600" : amount < 0 ? "text-rose-600" : "text-slate-800"
                      }`}
                    >
                      {formatMoney(amount, currency)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-800">{formatMoney(balanceAfter, currency)}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <div className="font-medium">{accountLabel}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.balance_accounts?.account_type ?? "N/A"} · {row.balance_account_id}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
