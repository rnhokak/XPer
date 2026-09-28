import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Loader2,
  Plus,
  Receipt,
  ShieldAlert,
  Users,
  RotateCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDebtsOverviewData, type Account, type Category, type Partner } from "@/hooks/useDebtsData";
import { useCashflowReportTransactions } from "@/hooks/useCashflowTransactions";
import { computeDebtExpenseStats } from "@/lib/cashflow/debtExpenseUtils";
import { processQueue } from "@/lib/sync/syncService";
import { DebtsTable } from "./components/DebtsTable";
import { DebtQuickAddDialog } from "./components/DebtQuickAddDialog";
import { DebtExpensesTracker } from "./components/DebtExpensesTracker";
import { PartnerDebtsList, groupDebtsByPartner } from "./components/PartnerDebtsList";
import { PartnerDebtsDetailDialog } from "./components/PartnerDebtsDetailDialog";
import { cn } from "@/lib/utils";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(val));

export default function DebtsPage() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading, error, refetch: refetchDebts, isFetching: debtsFetching } = useDebtsOverviewData(user?.id ?? "");
  const { data: allTransactions = [], refetch: refetchTransactions, isFetching: txFetching } = useCashflowReportTransactions();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"partners" | "contracts" | "expenses">("partners");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  const isBusy = isRefreshing || debtsFetching || txFetching;

  const handleRefresh = async () => {
    if (isBusy) return;
    setIsRefreshing(true);
    try {
      if (navigator.onLine) {
        await processQueue().catch(() => {});
      }
      await Promise.allSettled([refetchDebts(), refetchTransactions()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const debtExpenseStats = useMemo(
    () => computeDebtExpenseStats(allTransactions),
    [allTransactions]
  );
  const pendingSpecialExpenses = debtExpenseStats.lent.pendingCount + debtExpenseStats.borrowed.pendingCount;

  const accounts: Account[] = data?.accounts ?? [];
  const partners: Partner[] = useMemo(
    () => (data?.partners?.length ? data.partners : accounts.filter((a) => a.type === "partner")),
    [data?.partners, accounts]
  );
  const categories: Category[] = data?.categories ?? [];
  const debts = data?.debts ?? [];

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  // Group debts & transactions by partner
  const partnerSummaries = useMemo(() => {
    return groupDebtsByPartner(debts, partners, allTransactions);
  }, [debts, partners, allTransactions]);

  const selectedPartner = useMemo(() => {
    if (!selectedPartnerId) return null;
    return partnerSummaries.find((p) => p.partnerId === selectedPartnerId) ?? null;
  }, [partnerSummaries, selectedPartnerId]);

  // Comprehensive summary statistics (including both contracts and debt expenses)
  const { totalLendOutstanding, totalBorrowOutstanding, netDebt, lendCount, borrowCount, overdueCount } =
    useMemo(() => {
      const active = debts.filter((d) => d.status !== "paid_off" && d.status !== "cancelled");
      const contractLends = active.filter((d) => d.direction === "lend");
      const contractBorrows = active.filter((d) => d.direction === "borrow");

      const contractLendSum = contractLends.reduce(
        (sum, d) => sum + (d.outstanding_principal ?? d.principal_amount ?? 0),
        0
      );
      const contractBorrowSum = contractBorrows.reduce(
        (sum, d) => sum + (d.outstanding_principal ?? d.principal_amount ?? 0),
        0
      );

      const overdue = active.filter((d) => {
        if (d.status === "overdue") return true;
        if (d.due_date && new Date(d.due_date).getTime() < Date.now()) return true;
        return false;
      }).length;

      const totalLend = contractLendSum + debtExpenseStats.lent.remaining;
      const totalBorrow = contractBorrowSum + debtExpenseStats.borrowed.remaining;

      return {
        totalLendOutstanding: totalLend,
        totalBorrowOutstanding: totalBorrow,
        netDebt: totalLend - totalBorrow,
        lendCount: contractLends.length + debtExpenseStats.lent.pendingCount,
        borrowCount: contractBorrows.length + debtExpenseStats.borrowed.pendingCount,
        overdueCount: overdue,
      };
    }, [debts, debtExpenseStats]);

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
            Theo dõi tất cả hợp đồng vay, cho vay và các khoản chi cho vay, chi ghi nợ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isBusy}
            className="h-9 gap-1.5 rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all"
            title="Làm mới dữ liệu vay nợ"
          >
            <RotateCw className={cn("h-3.5 w-3.5", isBusy && "animate-spin text-primary")} />
            <span>{isBusy ? "Đang làm mới..." : "Làm mới"}</span>
          </Button>

          <Button
            asChild
            size="sm"
            className="h-9 gap-1.5 rounded-xl bg-emerald-600 text-xs font-semibold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20"
          >
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
              {lendCount} khoản (hợp đồng & chi cho vay)
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
              {borrowCount} khoản (hợp đồng & chi nợ)
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
              {partnerSummaries.length} đối tác
            </div>
            <div className="mt-1 flex flex-col gap-0.5 text-[11px]">
              {overdueCount > 0 ? (
                <span className="flex items-center gap-0.5 font-bold text-rose-600">
                  <ShieldAlert className="h-3 w-3" />
                  {overdueCount} khoản quá hạn
                </span>
              ) : (
                <span className="text-muted-foreground">Tất cả đúng hạn</span>
              )}
              {pendingSpecialExpenses > 0 && (
                <span className="font-medium text-amber-600">
                  {pendingSpecialExpenses} khoản chi chưa thanh toán
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("partners")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition shadow-2xs active:scale-95",
              viewMode === "partners"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
            )}
          >
            <Users className="h-4 w-4" />
            <span>Theo đối tác ({partnerSummaries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("contracts")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition shadow-2xs active:scale-95",
              viewMode === "contracts"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
            )}
          >
            <HandCoins className="h-4 w-4" />
            <span>Tất cả hợp đồng ({debts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("expenses")}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition shadow-2xs active:scale-95",
              viewMode === "expenses"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
            )}
          >
            <Receipt className="h-4 w-4" />
            <span>Chi mua hộ & Vay tiêu ({pendingSpecialExpenses})</span>
          </button>
        </div>
      </div>

      {/* Main View Content */}
      <div className="space-y-6">
        {viewMode === "partners" && (
          <PartnerDebtsList
            debts={debts}
            partners={partners}
            transactions={allTransactions}
            currency={defaultCurrency}
            onSelectPartner={(partner) => setSelectedPartnerId(partner.partnerId)}
          />
        )}

        {viewMode === "contracts" && <DebtsTable debts={debts} />}

        {viewMode === "expenses" && <DebtExpensesTracker currency={defaultCurrency} />}
      </div>

      {/* Unified Partner Detail Dialog */}
      <PartnerDebtsDetailDialog
        open={Boolean(selectedPartnerId && selectedPartner)}
        onClose={() => setSelectedPartnerId(null)}
        partnerSummary={selectedPartner}
        currency={defaultCurrency}
      />

      {/* Quick Add Dialog */}
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
