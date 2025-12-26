import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useTransactions } from "@/features/cashflow/hooks/useTransactions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const formatAmount = (amount: number, currency: string | null) => {
  const value = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);

  return value;
};

const typeLabel = (type: string) => {
  if (type === "income") return "Income";
  if (type === "transfer") return "Transfer";
  return "Expense";
};

export const CashflowListScreen = () => {
  const { data, isLoading } = useTransactions();

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Cashflow</p>
            <h1 className="text-2xl font-semibold text-slate-900">Daily ledger</h1>
          </div>
          <Button asChild className="rounded-full px-4 shadow-soft">
            <Link to="/new">
              <Plus className="h-4 w-4" />
              Add
            </Link>
          </Button>
        </div>
        <Card className="bg-slate-900 text-white">
          <div className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Balance snapshot</p>
            <p className="text-lg font-semibold">Keep tabs on your last 50 entries.</p>
          </div>
        </Card>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">Recent activity</h2>
          <span className="text-xs text-slate-400">Auto-updating</span>
        </div>

        {isLoading && !data ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-3">
            {data.map((item) => (
              <Card key={item.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{item.note || item.category?.name || "Unlabeled"}</p>
                    <p className="text-xs text-slate-500">
                      {typeLabel(item.type)} · {item.account?.name || "No account"}
                    </p>
                  </div>
                  <div className={cn("text-sm font-semibold", item.type === "expense" ? "text-rose-500" : "text-emerald-600")}>
                    {item.type === "expense" ? "-" : "+"}
                    {formatAmount(item.amount, item.currency)}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(item.transaction_time).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <p className="text-sm text-slate-600">No transactions yet. Add your first entry to get started.</p>
          </Card>
        )}
      </section>
    </div>
  );
};
