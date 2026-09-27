"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  parseDebtExpenseMeta,
  toggleDebtExpenseSettled,
} from "@/lib/cashflow/debtExpenseUtils";
import {
  useCashflowReportTransactions,
  useUpdateTransaction,
  type CashflowTransaction,
} from "@/hooks/useCashflowTransactions";
import { useNotificationsStore } from "@/store/notifications";
import {
  Check,
  CheckCircle2,
  Clock,
  HandCoins,
  Loader2,
  RotateCcw,
  Search,
  ShoppingBag,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "lent_pending" | "borrowed_pending" | "settled";

type Props = {
  currency?: string;
  filterPartnerName?: string | null;
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(val));

const formatDate = (val: string) => {
  const d = new Date(val);
  return Number.isNaN(d.getTime())
    ? val
    : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export function DebtExpensesTracker({ currency = "VND", filterPartnerName = null }: Props) {
  const { data: allTransactions = [], isLoading } = useCashflowReportTransactions();
  const updateTransaction = useUpdateTransaction();
  const notify = useNotificationsStore((s) => s.notify);

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Extract all expense transactions that have debt expense metadata
  const debtExpenseItems = useMemo(() => {
    return allTransactions
      .filter((tx) => tx.type === "expense")
      .map((tx) => {
        const meta = parseDebtExpenseMeta(tx.note);
        return {
          tx,
          meta,
        };
      })
      .filter(({ meta }) => {
        if (meta.mode === "none") return false;
        if (filterPartnerName) {
          return meta.partnerName?.toLowerCase() === filterPartnerName.toLowerCase();
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.tx.transaction_time).getTime() - new Date(a.tx.transaction_time).getTime()
      );
  }, [allTransactions, filterPartnerName]);

  // Aggregated totals
  const stats = useMemo(() => {
    let lentTotal = 0;
    let lentSettled = 0;
    let lentPending = 0;
    let lentCount = 0;
    let lentPendingCount = 0;

    let borrowedTotal = 0;
    let borrowedSettled = 0;
    let borrowedPending = 0;
    let borrowedCount = 0;
    let borrowedPendingCount = 0;

    for (const { tx, meta } of debtExpenseItems) {
      const amount = Number(tx.amount) || 0;
      if (meta.mode === "lent_spent") {
        lentTotal += amount;
        lentCount += 1;
        if (meta.isSettled) {
          lentSettled += amount;
        } else {
          lentPending += amount;
          lentPendingCount += 1;
        }
      } else if (meta.mode === "borrowed_spent") {
        borrowedTotal += amount;
        borrowedCount += 1;
        if (meta.isSettled) {
          borrowedSettled += amount;
        } else {
          borrowedPending += amount;
          borrowedPendingCount += 1;
        }
      }
    }

    return {
      lent: {
        total: lentTotal,
        settled: lentSettled,
        remaining: lentPending,
        count: lentCount,
        pendingCount: lentPendingCount,
      },
      borrowed: {
        total: borrowedTotal,
        settled: borrowedSettled,
        remaining: borrowedPending,
        count: borrowedCount,
        pendingCount: borrowedPendingCount,
      },
    };
  }, [debtExpenseItems]);

  // Filtered list based on active tab and search query
  const filteredList = useMemo(() => {
    return debtExpenseItems.filter(({ tx, meta }) => {
      // Tab filter
      if (activeTab === "lent_pending" && (meta.mode !== "lent_spent" || meta.isSettled)) {
        return false;
      }
      if (activeTab === "borrowed_pending" && (meta.mode !== "borrowed_spent" || meta.isSettled)) {
        return false;
      }
      if (activeTab === "settled" && !meta.isSettled) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const partner = (meta.partnerName || "").toLowerCase();
        const note = (meta.cleanNote || "").toLowerCase();
        const cat = (tx.category?.name || "").toLowerCase();
        const acc = (tx.account?.name || "").toLowerCase();
        return (
          partner.includes(query) ||
          note.includes(query) ||
          cat.includes(query) ||
          acc.includes(query)
        );
      }

      return true;
    });
  }, [debtExpenseItems, activeTab, searchQuery]);

  const handleToggleSettled = async (item: { tx: CashflowTransaction; meta: ReturnType<typeof parseDebtExpenseMeta> }) => {
    const { tx, meta } = item;
    const nextNote = toggleDebtExpenseSettled(tx.note);
    const willBeSettled = !meta.isSettled;

    setProcessingId(tx.id);
    try {
      await updateTransaction.mutateAsync({
        id: tx.id,
        values: {
          type: tx.type,
          amount: tx.amount,
          account_id: tx.account?.id ?? null,
          category_id: tx.category?.id ?? "",
          note: nextNote,
          transaction_time: tx.transaction_time,
          currency: tx.currency,
        },
      });

      notify({
        title: willBeSettled
          ? meta.mode === "lent_spent"
            ? "Đã đánh dấu đã thu lại tiền"
            : "Đã đánh dấu đã trả lại tiền"
          : "Đã chuyển về trạng thái cần thu/trả",
        type: "success",
      });
    } catch {
      notify({
        title: "Lỗi cập nhật",
        description: "Không thể thay đổi trạng thái, vui lòng thử lại.",
        type: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-48 w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 2 Main Aggregated Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Card 1: Mua hộ / Chi cho vay (Cần thu lại tiền) */}
        <Card className="overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/50 via-white to-sky-50/20 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle className="text-xs font-bold text-sky-900 uppercase tracking-wider">
                    Chi mua hộ / Cho vay
                  </CardTitle>
                  <p className="text-[11px] font-medium text-sky-700">
                    Cần thu lại tiền ({stats.lent.pendingCount} khoản chưa thu)
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-sky-300 bg-sky-100/60 text-sky-800 text-xs font-semibold">
                Phải thu lại
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-1 space-y-3">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Còn phải thu lại</div>
              <div className="money-blur text-xl sm:text-2xl font-black text-sky-700">
                {formatCurrency(stats.lent.remaining)} {currency}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-sky-50/60 p-2.5 text-xs border border-sky-100">
              <div>
                <span className="text-[11px] text-slate-500 block">Tổng đã chi hộ:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(stats.lent.total)} {currency}
                </span>
                <span className="text-[10px] text-slate-400 block">({stats.lent.count} khoản)</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Đã thu lại được:</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(stats.lent.settled)} {currency}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  ({stats.lent.count - stats.lent.pendingCount} khoản)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Chi từ tiền vay (Cần trả lại tiền) */}
        <Card className="overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <HandCoins className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Chi từ tiền vay
                  </CardTitle>
                  <p className="text-[11px] font-medium text-amber-700">
                    Cần trả lại tiền ({stats.borrowed.pendingCount} khoản chưa trả)
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-amber-300 bg-amber-100/60 text-amber-800 text-xs font-semibold">
                Phải trả lại
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-1 space-y-3">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Còn phải trả lại</div>
              <div className="money-blur text-xl sm:text-2xl font-black text-amber-700">
                {formatCurrency(stats.borrowed.remaining)} {currency}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-amber-50/60 p-2.5 text-xs border border-amber-100">
              <div>
                <span className="text-[11px] text-slate-500 block">Tổng đã chi từ vay:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(stats.borrowed.total)} {currency}
                </span>
                <span className="text-[10px] text-slate-400 block">({stats.borrowed.count} khoản)</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Đã trả lại được:</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(stats.borrowed.settled)} {currency}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  ({stats.borrowed.count - stats.borrowed.pendingCount} khoản)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "rounded-lg px-2.5 py-1.5 font-medium transition active:scale-95",
              activeTab === "all" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Tất cả ({debtExpenseItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("lent_pending")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition active:scale-95",
              activeTab === "lent_pending"
                ? "bg-white text-sky-700 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <span>Cần thu lại</span>
            {stats.lent.pendingCount > 0 && (
              <span className="rounded-full bg-sky-100 px-1.5 py-0.2 text-[10px] font-bold text-sky-700">
                {stats.lent.pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("borrowed_pending")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition active:scale-95",
              activeTab === "borrowed_pending"
                ? "bg-white text-amber-700 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <span>Cần trả lại</span>
            {stats.borrowed.pendingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-700">
                {stats.borrowed.pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settled")}
            className={cn(
              "rounded-lg px-2.5 py-1.5 font-medium transition active:scale-95",
              activeTab === "settled" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Đã xong ({debtExpenseItems.length - stats.lent.pendingCount - stats.borrowed.pendingCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm người, ghi chú, danh mục..."
            className="h-8.5 rounded-xl border-slate-200 bg-white pl-8.5 text-xs shadow-2xs"
          />
        </div>
      </div>

      {/* Transaction List */}
      {filteredList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-600">Chưa có khoản chi tiêu nào phù hợp</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Khi thêm giao dịch chi tiêu, chọn &quot;Chi từ tiền vay&quot; hoặc &quot;Mua hộ / Cho vay&quot; để quản lý tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredList.map((item) => {
            const { tx, meta } = item;
            const isLent = meta.mode === "lent_spent";
            const isSettled = meta.isSettled;
            const isBusy = processingId === tx.id;

            return (
              <div
                key={tx.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all shadow-2xs",
                  isSettled
                    ? "border-slate-200/70 bg-slate-50/50 opacity-80"
                    : isLent
                    ? "border-sky-200/90 bg-white hover:border-sky-300"
                    : "border-amber-200/90 bg-white hover:border-amber-300"
                )}
              >
                {/* Left: Icon, Mode Badge, Partner & Note */}
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm",
                      isSettled
                        ? "bg-emerald-100 text-emerald-700"
                        : isLent
                        ? "bg-sky-100 text-sky-700"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {isSettled ? (
                      <Check className="h-4 w-4" />
                    ) : isLent ? (
                      <ShoppingBag className="h-4 w-4" />
                    ) : (
                      <HandCoins className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Mode Badge */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-tight",
                          isLent
                            ? "bg-sky-100 text-sky-800"
                            : "bg-amber-100 text-amber-900"
                        )}
                      >
                        {isLent ? "Mua hộ / Cho vay" : "Chi từ tiền vay"}
                      </span>

                      {/* Partner Name Pill */}
                      {meta.partnerName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          <User className="h-2.5 w-2.5 text-slate-400" />
                          <span>{meta.partnerName}</span>
                        </span>
                      )}

                      {/* Status indicator */}
                      {isSettled ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{isLent ? "Đã thu lại" : "Đã trả lại"}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{isLent ? "Cần thu lại" : "Cần trả lại"}</span>
                        </span>
                      )}
                    </div>

                    {/* Note & Category */}
                    <div className="text-xs text-slate-800 font-medium">
                      {meta.cleanNote ? (
                        <span>{meta.cleanNote}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Không có ghi chú thêm</span>
                      )}
                    </div>

                    {/* Sub meta: Date & Account */}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{formatDate(tx.transaction_time)}</span>
                      {tx.category?.name && <span>• {tx.category.name}</span>}
                      {tx.account?.name && <span>• {tx.account.name}</span>}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Action Button */}
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 shrink-0 border-t pt-2 sm:border-0 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <span
                      className={cn(
                        "money-blur text-sm sm:text-base font-bold",
                        isSettled ? "text-slate-500 line-through" : isLent ? "text-sky-700" : "text-amber-800"
                      )}
                    >
                      {formatCurrency(tx.amount)} {tx.currency || currency}
                    </span>
                  </div>

                  {/* Toggle Settled Button */}
                  <Button
                    type="button"
                    size="sm"
                    variant={isSettled ? "outline" : "default"}
                    disabled={isBusy}
                    onClick={() => handleToggleSettled(item)}
                    className={cn(
                      "h-8 rounded-xl text-xs font-semibold transition active:scale-95",
                      isSettled
                        ? "border-slate-200 text-slate-600 hover:bg-slate-100"
                        : isLent
                        ? "bg-sky-600 text-white hover:bg-sky-700 shadow-2xs shadow-sky-600/20"
                        : "bg-amber-600 text-white hover:bg-amber-700 shadow-2xs shadow-amber-600/20"
                    )}
                  >
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isSettled ? (
                      <span className="flex items-center gap-1">
                        <RotateCcw className="h-3 w-3" />
                        <span>Chưa thu/trả</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>{isLent ? "Đã thu lại" : "Đã trả lại"}</span>
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
