import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  HandCoins,
  Minus,
  PlusCircle,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  useCashflowAccounts,
  useCashflowReportTransactions,
  useCashflowTransactions,
  type CashflowTransaction,
} from "@/hooks/useCashflowTransactions";
import { useDebtsOverviewData } from "@/hooks/useDebtsData";
import { CashflowCumulativeChart } from "./components/CashflowCumulativeChart";
import { DashboardDebtsWidget } from "./components/DashboardDebtsWidget";
import { getCategoryEmoji } from "../cashflow/components/CashflowQuickAddForm";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const range = "month";

  // Cashflow queries
  const { data: currentTransactions = [], isLoading: currentLoading } = useCashflowTransactions(range, 0);
  const { data: previousTransactions = [], isLoading: previousLoading } = useCashflowTransactions(range, -1);
  const { data: reportTransactions = [], isLoading: reportLoading } = useCashflowReportTransactions();
  const { data: accounts = [] } = useCashflowAccounts();

  // Debts queries
  const { data: debtsData, isLoading: debtsLoading } = useDebtsOverviewData(user?.id ?? "");
  const debts = debtsData?.debts ?? [];

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  // Summarize cashflow transactions
  const summarize = (transactions: CashflowTransaction[]) =>
    transactions.reduce(
      (acc, tx) => {
        if (tx.type === "income") acc.income += tx.amount;
        if (tx.type === "expense") acc.expense += tx.amount;
        acc.count += 1;
        return acc;
      },
      { income: 0, expense: 0, count: 0 }
    );

  const currentSummary = useMemo(() => summarize(currentTransactions), [currentTransactions]);
  const previousSummary = useMemo(() => summarize(previousTransactions), [previousTransactions]);

  const currentNet = currentSummary.income - currentSummary.expense;
  const previousNet = previousSummary.income - previousSummary.expense;

  // Debts summary
  const { totalLendOutstanding, totalBorrowOutstanding, netDebt } = useMemo(() => {
    const active = debts.filter((d) => d.status !== "paid_off" && d.status !== "cancelled");
    const lendSum = active
      .filter((d) => d.direction === "lend")
      .reduce((sum, d) => sum + (d.outstanding_principal ?? d.principal_amount ?? 0), 0);
    const borrowSum = active
      .filter((d) => d.direction === "borrow")
      .reduce((sum, d) => sum + (d.outstanding_principal ?? d.principal_amount ?? 0), 0);
    return {
      totalLendOutstanding: lendSum,
      totalBorrowOutstanding: borrowSum,
      netDebt: lendSum - borrowSum,
    };
  }, [debts]);

  const compare = (current: number, previous: number) => {
    if (current === 0 && previous === 0) {
      return { diff: 0, pct: 0, trend: "flat" as const };
    }
    if (previous === 0) {
      return { diff: current, pct: 100, trend: current >= 0 ? ("up" as const) : ("down" as const) };
    }
    const diff = current - previous;
    const pct = (diff / Math.abs(previous)) * 100;
    if (diff > 0) return { diff, pct, trend: "up" as const };
    if (diff < 0) return { diff, pct, trend: "down" as const };
    return { diff: 0, pct: 0, trend: "flat" as const };
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(value));

  const formatDiff = (value: number) => `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;

  const incomeCompare = compare(currentSummary.income, previousSummary.income);
  const expenseCompare = compare(currentSummary.expense, previousSummary.expense);
  const netCompare = compare(currentNet, previousNet);

  const recentTransactions = useMemo(() => {
    return [...reportTransactions]
      .sort((a, b) => new Date(b.transaction_time).getTime() - new Date(a.transaction_time).getTime())
      .slice(0, 6);
  }, [reportTransactions]);

  const loading = currentLoading || previousLoading;

  const renderTrend = (trend: "up" | "down" | "flat") => {
    if (trend === "up") return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />;
    if (trend === "down") return <ArrowDownRight className="h-3.5 w-3.5 text-rose-600" />;
    return <Minus className="h-3.5 w-3.5 text-slate-400" />;
  };

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }, []);

  const displayName = user?.display_name || user?.email?.split("@")[0] || "bạn";

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header with Greeting & Quick Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{greeting}, {displayName}!</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Tổng quan tài chính</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Theo dõi dòng tiền, chi tiêu và công nợ một cách trực quan
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-9 gap-1.5 rounded-xl border-slate-200 text-xs font-medium">
            <Link to="/debts/new">
              <HandCoins className="h-3.5 w-3.5 text-blue-600" />
              <span>Khoản vay mới</span>
            </Link>
          </Button>

          <Button asChild size="sm" className="h-9 gap-1.5 rounded-xl bg-emerald-600 text-xs font-semibold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20">
            <Link to="/cashflow/new">
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Thêm giao dịch</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Top 4 Key Metric Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* 1. Thu nhập tháng này */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-shadow hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs font-semibold text-slate-600">Thu nhập tháng</CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Wallet className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 sm:p-4 sm:pt-0">
            {loading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className="money-blur text-lg font-bold text-slate-900 sm:text-2xl">
                {formatCurrency(currentSummary.income)} đ
              </div>
            )}
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              {renderTrend(incomeCompare.trend)}
              <span className={incomeCompare.trend === "up" ? "font-semibold text-emerald-600" : incomeCompare.trend === "down" ? "font-semibold text-rose-600" : ""}>
                {formatDiff(incomeCompare.diff)} ({Math.abs(incomeCompare.pct).toFixed(0)}%)
              </span>
              <span className="hidden sm:inline">vs kỳ trước</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Chi tiêu tháng này */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-shadow hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs font-semibold text-slate-600">Chi tiêu tháng</CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <Receipt className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 sm:p-4 sm:pt-0">
            {loading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className="money-blur text-lg font-bold text-slate-900 sm:text-2xl">
                {formatCurrency(currentSummary.expense)} đ
              </div>
            )}
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              {renderTrend(expenseCompare.trend)}
              <span className={expenseCompare.trend === "down" ? "font-semibold text-emerald-600" : expenseCompare.trend === "up" ? "font-semibold text-rose-600" : ""}>
                {formatDiff(expenseCompare.diff)} ({Math.abs(expenseCompare.pct).toFixed(0)}%)
              </span>
              <span className="hidden sm:inline">vs kỳ trước</span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Dòng tiền ròng tháng này */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-shadow hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs font-semibold text-slate-600">Dòng tiền ròng</CardTitle>
            <span className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              currentNet >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>
              {currentNet >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            </span>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 sm:p-4 sm:pt-0">
            {loading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div
                className={cn(
                  "money-blur text-lg font-bold sm:text-2xl",
                  currentNet >= 0 ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {currentNet >= 0 ? "+" : ""}
                {formatCurrency(currentNet)} đ
              </div>
            )}
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              {renderTrend(netCompare.trend)}
              <span>
                {formatDiff(netCompare.diff)} ({Math.abs(netCompare.pct).toFixed(0)}%)
              </span>
              <span className="hidden sm:inline">vs kỳ trước</span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Vị thế vay nợ */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-shadow hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs font-semibold text-slate-600">Vay & Nợ ròng</CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <HandCoins className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 sm:p-4 sm:pt-0">
            {debtsLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div
                className={cn(
                  "money-blur text-lg font-bold sm:text-2xl",
                  netDebt > 0 ? "text-emerald-600" : netDebt < 0 ? "text-rose-600" : "text-slate-900"
                )}
              >
                {netDebt > 0 ? "+" : ""}
                {formatCurrency(netDebt)} đ
              </div>
            )}
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Cho vay: <span className="font-semibold text-emerald-600">{formatCurrency(totalLendOutstanding)}</span></span>
              <span>Nợ: <span className="font-semibold text-rose-600">{formatCurrency(totalBorrowOutstanding)}</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Shortcuts Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/cashflow/new"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-95"
        >
          <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
          <span>Ghi nhận chi tiêu / thu nhập</span>
        </Link>
        <Link
          to="/debts/new"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-95"
        >
          <HandCoins className="h-3.5 w-3.5 text-blue-600" />
          <span>Thêm khoản vay / nợ</span>
        </Link>
        <Link
          to="/reports"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-95"
        >
          <BarChart3 className="h-3.5 w-3.5 text-amber-600" />
          <span>Báo cáo theo danh mục</span>
        </Link>
        <Link
          to="/cashflow/accounts"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-95"
        >
          <CreditCard className="h-3.5 w-3.5 text-indigo-600" />
          <span>Quản lý tài khoản ({accounts.length})</span>
        </Link>
      </div>

      {/* Hero 30-Day Cumulative Cashflow Chart */}
      <div>
        <CashflowCumulativeChart
          transactions={reportTransactions}
          isLoading={reportLoading}
        />
      </div>

      {/* Debts Widget & Recent Activity Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Debts Widget (7 cols) */}
        <div className="lg:col-span-7">
          <DashboardDebtsWidget
            debts={debts}
            currency={defaultCurrency}
            isLoading={debtsLoading}
          />
        </div>

        {/* Right: Recent Activity (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 sm:text-lg">
                    Giao dịch gần đây
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Các dòng tiền phát sinh mới nhất
                  </CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-8 rounded-xl text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700">
                  <Link to="/cashflow">Xem tất cả</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-4 sm:p-5">
              {loading && recentTransactions.length === 0 ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ) : recentTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Wallet className="h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Chưa có giao dịch nào. Thêm giao dịch đầu tiên để bắt đầu!
                  </p>
                  <Button asChild size="sm" className="mt-3 h-8 rounded-xl bg-emerald-600 text-xs">
                    <Link to="/cashflow/new">Thêm giao dịch</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentTransactions.map((tx) => {
                    const categoryName = tx.category?.name ?? "Khác";
                    const emoji = getCategoryEmoji(categoryName);
                    const isIncome = tx.type === "income";
                    const isTransfer = tx.type === "transfer";
                    const amountFormatted = formatCurrency(tx.amount);
                    const dateFormatted = new Date(tx.transaction_time).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5 transition hover:bg-slate-50 active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-base shadow-2xs border border-slate-100">
                            {emoji}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {tx.note || categoryName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {dateFormatted} {tx.account?.name ? `• ${tx.account.name}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-2">
                          <p
                            className={cn(
                              "money-blur text-xs sm:text-sm font-bold",
                              isIncome ? "text-emerald-600" : isTransfer ? "text-blue-600" : "text-rose-600"
                            )}
                          >
                            {isIncome ? "+" : isTransfer ? "•" : "-"}
                            {amountFormatted} đ
                          </p>
                          <span className="text-[10px] uppercase font-semibold text-slate-400">
                            {isIncome ? "Thu" : isTransfer ? "Chuyển" : "Chi"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
