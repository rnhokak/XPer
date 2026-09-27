import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  ShieldAlert,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDebtsOverviewData } from "@/hooks/useDebtsData";
import { useCashflowReportTransactions } from "@/hooks/useCashflowTransactions";
import { computeDebtExpenseStats } from "@/lib/cashflow/debtExpenseUtils";
import { PartnerDebtsList } from "./components/PartnerDebtsList";
import {
  PartnerDebtsDetailDialog,
  type PartnerDebtSummary,
} from "./components/PartnerDebtsDetailDialog";
import { DebtsTable } from "./components/DebtsTable";
import { DebtQuickAddDialog } from "./components/DebtQuickAddDialog";
import { DebtExpensesTracker } from "./components/DebtExpensesTracker";
import { cn } from "@/lib/utils";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(val));

export default function DebtsPage() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading, error } = useDebtsOverviewData(user?.id ?? "");
  const { data: allTransactions = [] } = useCashflowReportTransactions();

  const [selectedPartner, setSelectedPartner] = useState<PartnerDebtSummary | null>(null);
  const [viewMode, setViewMode] = useState<"partners" | "debts" | "expenses">("partners");

  const debtExpenseStats = useMemo(
    () => computeDebtExpenseStats(allTransactions),
    [allTransactions]
  );
  const totalSpecialExpenses = debtExpenseStats.lent.count + debtExpenseStats.borrowed.count;
  const pendingSpecialExpenses = debtExpenseStats.lent.pendingCount + debtExpenseStats.borrowed.pendingCount;

  const partners = data?.partners ?? [];
  const accounts = data?.accounts ?? [];
  const categories = (data?.categories ?? []).filter((c) => c.type === "debt");
  const debts = data?.debts ?? [];

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  // Summary statistics
  const { totalLendOutstanding, totalBorrowOutstanding, netDebt, lendCount, borrowCount, overdueCount } =
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

      const overdue = active.filter((d) => {
        if (d.status === "overdue") return true;
        if (d.due_date && new Date(d.due_date).getTime() < Date.now()) return true;
        return false;
      }).length;

      return {
        totalLendOutstanding: lendSum,
        totalBorrowOutstanding: borrowSum,
        netDebt: lendSum - borrowSum,
        lendCount: lends.length,
        borrowCount: borrows.length,
        overdueCount: overdue,
      };
    }, [debts]);

  if (authLoading || isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 p-6 text-sm text-rose-700">
        Không thể tải dữ liệu vay nợ. Vui lòng thử lại sau.
      </div>
    );
  }

  const isNetLending = netDebt > 0;
  const isNetBorrowing = netDebt < 0;

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Quản lý Vay & Nợ
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Theo dõi danh sách người/tổ chức vay & cho vay, tổng tiền và chi tiết từng bên
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-slate-200 text-xs font-medium">
            <Link to="/debts/partners">
              <Users className="h-3.5 w-3.5 text-slate-500" />
              <span>Đối tác ({partners.length})</span>
            </Link>
          </Button>

          <Button asChild size="sm" className="h-9 gap-1.5 rounded-xl bg-emerald-600 text-xs font-semibold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20">
            <Link to="/debts/new">
              <Plus className="h-3.5 w-3.5" />
              <span>Khoản vay mới</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* 1. Cho vay (Phải thu) */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-shadow hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
              Cho vay (Phải thu)
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 sm:p-4 sm:pt-0">
            <div className="money-blur text-lg font-bold text-emerald-700 sm:text-2xl">
              {formatCurrency(totalLendOutstanding)} {defaultCurrency}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {lendCount} khoản nợ đang cho vay
            </p>
          </CardContent>
        </Card>

        {/* 2. Đi vay (Phải trả) */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-shadow hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs font-semibold text-rose-800 uppercase tracking-wide">
              Đi vay (Phải trả)
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <ArrowDownLeft className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 sm:p-4 sm:pt-0">
            <div className="money-blur text-lg font-bold text-rose-700 sm:text-2xl">
              {formatCurrency(totalBorrowOutstanding)} {defaultCurrency}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {borrowCount} khoản nợ đang đi vay
            </p>
          </CardContent>
        </Card>

        {/* 3. Vị thế nợ ròng */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-shadow hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Vị thế nợ ròng
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <HandCoins className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 sm:p-4 sm:pt-0">
            <div
              className={cn(
                "money-blur text-lg font-bold sm:text-2xl",
                isNetLending ? "text-emerald-700" : isNetBorrowing ? "text-rose-700" : "text-slate-800"
              )}
            >
              {isNetLending ? "+" : isNetBorrowing ? "-" : ""}
              {formatCurrency(Math.abs(netDebt))} {defaultCurrency}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isNetLending ? "Thặng dư phải thu" : isNetBorrowing ? "Nghĩa vụ phải trả" : "Đã cân bằng"}
            </p>
          </CardContent>
        </Card>

        {/* 4. Đối tác & Quá hạn */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-shadow hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Đối tác liên quan
            </CardTitle>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="h-3.5 w-3.5" />
            </span>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 sm:p-4 sm:pt-0">
            <div className="text-lg font-bold text-slate-900 sm:text-2xl">
              {partners.length} đối tác
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {overdueCount > 0 ? (
                <span className="flex items-center gap-0.5 font-bold text-rose-600">
                  <ShieldAlert className="h-3 w-3" />
                  {overdueCount} khoản quá hạn
                </span>
              ) : (
                <span className="text-muted-foreground">Tất cả đúng hạn</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Section Header with View Mode Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {viewMode === "partners"
              ? "Danh sách người / tổ chức vay nợ"
              : viewMode === "debts"
              ? "Tất cả các khoản nợ lẻ"
              : "Chi tiêu mua hộ & Chi từ tiền vay"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {viewMode === "partners"
              ? "Bấm vào từng người/tổ chức để xem chi tiết các khoản vay & cho vay của bên đó"
              : viewMode === "debts"
              ? "Danh sách chi tiết từng hợp đồng khoản vay riêng lẻ"
              : "Theo dõi các khoản tiền mua hộ cần thu lại và các khoản chi từ tiền vay cần trả lại"}
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center rounded-xl bg-slate-100 p-1 text-xs self-start sm:self-auto gap-1">
          <button
            type="button"
            onClick={() => setViewMode("partners")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition active:scale-95",
              viewMode === "partners"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Theo Người / Tổ chức</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("debts")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition active:scale-95",
              viewMode === "debts"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <List className="h-3.5 w-3.5" />
            <span>Hợp đồng vay ({debts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("expenses")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition active:scale-95",
              viewMode === "expenses"
                ? "bg-white text-sky-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ShoppingBag className="h-3.5 w-3.5 text-sky-600" />
            <span>Chi mua hộ & Vay tiêu</span>
            {totalSpecialExpenses > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                  pendingSpecialExpenses > 0
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-200 text-slate-700"
                )}
              >
                {totalSpecialExpenses}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Content based on View Mode */}
      {viewMode === "partners" ? (
        <PartnerDebtsList
          debts={debts}
          partners={partners}
          onSelectPartner={(p) => setSelectedPartner(p)}
          currency={defaultCurrency}
        />
      ) : viewMode === "debts" ? (
        <DebtsTable debts={debts} />
      ) : (
        <DebtExpensesTracker currency={defaultCurrency} />
      )}

      {/* Partner Detail Dialog: Opens when tapping on any partner */}
      <PartnerDebtsDetailDialog
        open={Boolean(selectedPartner)}
        onClose={() => setSelectedPartner(null)}
        partnerSummary={selectedPartner}
        currency={defaultCurrency}
      />

      <DebtQuickAddDialog
        partners={partners}
        accounts={accounts}
        categories={categories}
        defaultAccountId={defaultAccount?.id}
        defaultCurrency={defaultCurrency}
      />
    </div>
  );
}
