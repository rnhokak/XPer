import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type DebtRow, type Partner } from "@/hooks/useDebtsData";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, HandCoins, Plus, ShieldAlert, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  debts: DebtRow[];
  partners?: Partner[];
  currency?: string;
  isLoading?: boolean;
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(val));

export function DashboardDebtsWidget({ debts = [], currency = "VND", isLoading = false }: Props) {
  const { totalLendOutstanding, totalBorrowOutstanding, netDebt, activeLends, activeBorrows, upcomingDebts } =
    useMemo(() => {
      const active = debts.filter((d) => d.status !== "paid_off" && d.status !== "cancelled");

      const lends = active.filter((d) => d.direction === "lend");
      const borrows = active.filter((d) => d.direction === "borrow");

      const lendSum = lends.reduce(
        (sum, d) => sum + (d.outstanding_principal ?? d.principal_amount ?? 0),
        0
      );
      const borrowSum = borrows.reduce(
        (sum, d) => sum + (d.outstanding_principal ?? d.principal_amount ?? 0),
        0
      );

      const net = lendSum - borrowSum;

      // Sort debts by due_date (earliest first) or largest outstanding
      const sorted = [...active].sort((a, b) => {
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return (b.outstanding_principal ?? 0) - (a.outstanding_principal ?? 0);
      });

      return {
        totalLendOutstanding: lendSum,
        totalBorrowOutstanding: borrowSum,
        netDebt: net,
        activeLends: lends,
        activeBorrows: borrows,
        upcomingDebts: sorted.slice(0, 4),
      };
    }, [debts]);

  if (isLoading) {
    return (
      <Card className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <Skeleton className="h-6 w-36" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </Card>
    );
  }

  const isNetLending = netDebt > 0;

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <HandCoins className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 sm:text-lg">
                Theo dõi vay & nợ
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Tổng hợp các khoản cho vay & đang đi vay
              </CardDescription>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 rounded-xl text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700">
            <Link to="/debts">
              <span>Chi tiết</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* 2 Primary Side Cards: Cho vay & Đi vay */}
        <div className="grid grid-cols-2 gap-2.5 pt-3">
          {/* Cho vay (Phải thu) */}
          <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/70 to-white p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                Cho vay (Phải thu)
              </span>
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                {activeLends.length} khoản
              </span>
            </div>
            <div className="mt-1.5">
              <span className="money-blur text-lg font-bold text-emerald-700 sm:text-xl">
                {formatCurrency(totalLendOutstanding)} {currency}
              </span>
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-600/90">
              Người khác đang nợ bạn
            </div>
          </div>

          {/* Đi vay (Phải trả) */}
          <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-b from-rose-50/70 to-white p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-800">
                Đi vay (Phải trả)
              </span>
              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                {activeBorrows.length} khoản
              </span>
            </div>
            <div className="mt-1.5">
              <span className="money-blur text-lg font-bold text-rose-700 sm:text-xl">
                {formatCurrency(totalBorrowOutstanding)} {currency}
              </span>
            </div>
            <div className="mt-0.5 text-[10px] text-rose-600/90">
              Bạn đang nợ người khác
            </div>
          </div>
        </div>

        {/* Net Debt Position Summary */}
        <div className="mt-2.5 flex items-center justify-between rounded-xl bg-slate-100/80 px-3 py-2 text-xs">
          <span className="font-medium text-slate-600">Vị thế nợ ròng:</span>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "money-blur font-bold",
                isNetLending ? "text-emerald-600" : netDebt < 0 ? "text-rose-600" : "text-slate-600"
              )}
            >
              {isNetLending ? "+" : ""}
              {formatCurrency(netDebt)} {currency}
            </span>
            <span className="text-[10px] text-slate-500">
              ({isNetLending ? "Thặng dư phải thu" : netDebt < 0 ? "Nghĩa vụ phải trả" : "Cân bằng"})
            </span>
          </div>
        </div>
      </CardHeader>

      {/* Body: Upcoming and Active Debts list */}
      <CardContent className="flex-1 p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Khoản vay & nợ cần chú ý
            </span>
            <Link
              to="/debts/new"
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              <Plus className="h-3 w-3" />
              <span>Khoản mới</span>
            </Link>
          </div>

          {upcomingDebts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-6 text-center">
              <HandCoins className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs font-medium text-slate-500">Không có khoản vay/nợ nào đang hoạt động</p>
              <Button asChild size="sm" variant="outline" className="mt-3 h-8 rounded-xl text-xs">
                <Link to="/debts/new">Thêm khoản vay mới</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingDebts.map((debt) => {
                const isLend = debt.direction === "lend";
                const partnerName = debt.partner?.name ?? "Đối tác";
                const remaining = debt.outstanding_principal ?? debt.principal_amount ?? 0;
                const dueDate = debt.due_date ? new Date(debt.due_date) : null;
                const isOverdue = dueDate && dueDate.getTime() < Date.now() && debt.status !== "paid_off";

                return (
                  <Link
                    key={debt.id}
                    to={`/debts`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/50 p-2.5 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                          isLend ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}
                      >
                        {isLend ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{partnerName}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>{isLend ? "Cho vay" : "Đi vay"}</span>
                          {dueDate && (
                            <>
                              <span>•</span>
                              <span className={cn(isOverdue && "font-semibold text-rose-600")}>
                                Hạn: {dueDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <p
                        className={cn(
                          "money-blur text-xs sm:text-sm font-bold",
                          isLend ? "text-emerald-600" : "text-rose-600"
                        )}
                      >
                        {isLend ? "+" : "-"}
                        {formatCurrency(remaining)} đ
                      </p>
                      {isOverdue ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600">
                          <ShieldAlert className="h-2.5 w-2.5" /> Quá hạn
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">còn lại</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Quick links footer */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <Link
              to="/debts/partners"
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Đối tác cho vay / vay</span>
            </Link>
            <Link
              to="/debts"
              className="font-semibold text-blue-600 hover:underline"
            >
              Xem tất cả ({debts.length})
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
