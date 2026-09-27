import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DebtRow, type Partner } from "@/hooks/useDebtsData";
import {
  useUpdateTransaction,
  type CashflowTransaction,
} from "@/hooks/useCashflowTransactions";
import { useNotificationsStore } from "@/store/notifications";
import {
  type DebtExpenseMeta,
  toggleDebtExpenseSettled,
} from "@/lib/cashflow/debtExpenseUtils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  HandCoins,
  Loader2,
  Percent,
  Phone,
  Plus,
  RotateCcw,
  ShieldAlert,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PartnerExpenseItem = {
  tx: CashflowTransaction;
  meta: DebtExpenseMeta;
};

export type UnifiedPartnerDebtItem = {
  id: string;
  source: "contract" | "expense";
  itemType: "lend" | "borrow" | "lent_spent" | "borrowed_spent";
  tag: "cho_vay" | "vay" | "chi_cho_vay" | "chi_no";
  tagLabel: string;
  tagColorClass: string;
  title: string;
  amount: number;
  remainingAmount: number;
  currency: string;
  date: string;
  dueDate: string | null;
  status: string;
  statusLabel: string;
  isSettled: boolean;
  isOverdue: boolean;
  note?: string | null;
  categoryName?: string;
  accountName?: string;
  interest?: string | null;
  rawDebt?: DebtRow;
  rawTx?: CashflowTransaction;
  rawExpenseMeta?: DebtExpenseMeta;
};

export type PartnerDebtSummary = {
  partnerId: string;
  partnerName: string;
  partnerType: string | null;
  phone: string | null;
  note: string | null;
  partner: Partner | null;
  totalLendOutstanding: number;
  totalBorrowOutstanding: number;
  netBalance: number;
  totalLendOriginal: number;
  totalBorrowOriginal: number;
  debts: DebtRow[];
  expenses: PartnerExpenseItem[];
  items: UnifiedPartnerDebtItem[];
  activeItemsCount: number;
  settledItemsCount: number;
  lendDebtsCount: number;
  borrowDebtsCount: number;
  lentExpensesCount: number;
  borrowedExpensesCount: number;
  hasOverdue: boolean;
  lastActivityDate: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  partnerSummary: PartnerDebtSummary | null;
  currency?: string;
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(val));

const formatDate = (val: string | null) =>
  val ? new Date(val).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export function PartnerDebtsDetailDialog({
  open,
  onClose,
  partnerSummary,
  currency = "VND",
}: Props) {
  const [filterMode, setFilterMode] = useState<"all" | "active" | "settled">("all");
  const [tagFilter, setTagFilter] = useState<"all" | "cho_vay" | "vay" | "chi_cho_vay" | "chi_no">("all");
  const [processingTxId, setProcessingTxId] = useState<string | null>(null);

  const updateTransaction = useUpdateTransaction();
  const notify = useNotificationsStore((s) => s.notify);

  if (!partnerSummary) return null;

  const isBusiness =
    partnerSummary.partnerType?.toLowerCase().includes("doanh nghiệp") ||
    partnerSummary.partnerType?.toLowerCase().includes("công ty") ||
    partnerSummary.partnerType?.toLowerCase().includes("ngân hàng");

  const isNetLending = partnerSummary.netBalance > 0;
  const isNetBorrowing = partnerSummary.netBalance < 0;

  // Filter items by status and tag
  const filteredItems = partnerSummary.items.filter((item) => {
    if (filterMode === "active" && item.isSettled) return false;
    if (filterMode === "settled" && !item.isSettled) return false;
    if (tagFilter !== "all" && item.tag !== tagFilter) return false;
    return true;
  });

  const handleToggleSettled = async (item: UnifiedPartnerDebtItem) => {
    if (item.source !== "expense" || !item.rawTx || !item.rawExpenseMeta) return;

    const tx = item.rawTx;
    const meta = item.rawExpenseMeta;
    const nextNote = toggleDebtExpenseSettled(tx.note);
    const willBeSettled = !meta.isSettled;

    setProcessingTxId(tx.id);
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
      setProcessingTxId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-0 rounded-3xl border-slate-200 shadow-xl">
        {/* Header */}
        <div className="border-b border-slate-100 bg-slate-50/80 p-5 sm:p-6">
          <DialogHeader className="space-y-1 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-bold shadow-xs",
                    isBusiness ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                  )}
                >
                  {isBusiness ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </span>
                <div>
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    {partnerSummary.partnerName}
                  </DialogTitle>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="rounded-lg text-[10px] font-semibold">
                      {partnerSummary.partnerType || "Đối tác"}
                    </Badge>
                    {partnerSummary.phone && (
                      <a
                        href={`tel:${partnerSummary.phone}`}
                        className="flex items-center gap-1 font-medium text-slate-600 hover:text-emerald-600"
                      >
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>{partnerSummary.phone}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <Button
                asChild
                size="sm"
                className="h-8 gap-1 rounded-xl bg-emerald-600 text-xs hover:bg-emerald-700 shadow-sm"
              >
                <Link to="/debts/new">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Khoản vay mới</span>
                </Link>
              </Button>
            </div>
            <DialogDescription className="sr-only">
              Chi tiết các khoản vay, cho vay, chi cho vay và chi nợ của {partnerSummary.partnerName}
            </DialogDescription>
          </DialogHeader>

          {/* Partner Balance Summary Box */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {/* Vị thế bù trừ ròng */}
            <div
              className={cn(
                "rounded-2xl border p-3.5 sm:col-span-2",
                isNetLending
                  ? "border-emerald-200 bg-emerald-50/70"
                  : isNetBorrowing
                  ? "border-rose-200 bg-rose-50/70"
                  : "border-slate-200 bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Vị thế bù trừ ròng
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    isNetLending
                      ? "bg-emerald-100 text-emerald-800"
                      : isNetBorrowing
                      ? "bg-rose-100 text-rose-800"
                      : "bg-slate-100 text-slate-700"
                  )}
                >
                  {isNetLending
                    ? "Họ đang nợ bạn"
                    : isNetBorrowing
                    ? "Bạn đang nợ họ"
                    : "Đã cân bằng / Tất toán"}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span
                  className={cn(
                    "money-blur text-2xl font-black tracking-tight",
                    isNetLending ? "text-emerald-700" : isNetBorrowing ? "text-rose-700" : "text-slate-800"
                  )}
                >
                  {isNetLending ? "+" : isNetBorrowing ? "-" : ""}
                  {formatCurrency(Math.abs(partnerSummary.netBalance))} {currency}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {isNetLending
                  ? `Sau khi bù trừ hợp đồng vay/nợ và các khoản chi mua hộ/chi nợ, ${partnerSummary.partnerName} còn nợ bạn số tiền trên.`
                  : isNetBorrowing
                  ? `Sau khi bù trừ hợp đồng vay/nợ và các khoản chi mua hộ/chi nợ, bạn còn nợ ${partnerSummary.partnerName} số tiền trên.`
                  : `Không có dư nợ chưa thanh toán với ${partnerSummary.partnerName}.`}
              </p>
            </div>

            {/* Chi tiết Cho vay & Chi cho vay (Phải thu) */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> Cho vay & Chi cho vay (Phải thu)
              </span>
              <p className="money-blur mt-1 text-lg font-bold text-emerald-700">
                {formatCurrency(partnerSummary.totalLendOutstanding)} {currency}
              </p>
              <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Gốc ban đầu:</span>
                  <span className="money-blur font-medium">
                    {formatCurrency(partnerSummary.totalLendOriginal)} {currency}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {partnerSummary.lendDebtsCount} khoản cho vay · {partnerSummary.lentExpensesCount} chi cho vay/mua hộ
                </span>
              </div>
            </div>

            {/* Chi tiết Đi vay & Chi nợ (Phải trả) */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-800 flex items-center gap-1">
                <ArrowDownLeft className="h-3.5 w-3.5 text-rose-600" /> Đi vay & Chi nợ (Phải trả)
              </span>
              <p className="money-blur mt-1 text-lg font-bold text-rose-700">
                {formatCurrency(partnerSummary.totalBorrowOutstanding)} {currency}
              </p>
              <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Gốc ban đầu:</span>
                  <span className="money-blur font-medium">
                    {formatCurrency(partnerSummary.totalBorrowOriginal)} {currency}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {partnerSummary.borrowDebtsCount} khoản đi vay · {partnerSummary.borrowedExpensesCount} chi ghi nợ
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Unified List of Items */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Danh sách chi tiết ({partnerSummary.items.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Bao gồm hợp đồng vay/nợ và các khoản chi cho vay, chi nợ
                </p>
              </div>

              {/* Status Filter tabs */}
              <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-semibold transition active:scale-95",
                    filterMode === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Tất cả ({partnerSummary.items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("active")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-semibold transition active:scale-95",
                    filterMode === "active" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Đang nợ ({partnerSummary.activeItemsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("settled")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-semibold transition active:scale-95",
                    filterMode === "settled" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Đã xong ({partnerSummary.settledItemsCount})
                </button>
              </div>
            </div>

            {/* Tag Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-medium text-slate-400 mr-1">Lọc theo tag:</span>
              <button
                type="button"
                onClick={() => setTagFilter("all")}
                className={cn(
                  "rounded-lg px-2 py-0.5 text-[11px] font-medium transition",
                  tagFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setTagFilter("cho_vay")}
                className={cn(
                  "rounded-lg px-2 py-0.5 text-[11px] font-medium transition",
                  tagFilter === "cho_vay"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                )}
              >
                Cho vay ({partnerSummary.lendDebtsCount})
              </button>
              <button
                type="button"
                onClick={() => setTagFilter("vay")}
                className={cn(
                  "rounded-lg px-2 py-0.5 text-[11px] font-medium transition",
                  tagFilter === "vay"
                    ? "bg-rose-600 text-white"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                )}
              >
                Vay / Nợ ({partnerSummary.borrowDebtsCount})
              </button>
              <button
                type="button"
                onClick={() => setTagFilter("chi_cho_vay")}
                className={cn(
                  "rounded-lg px-2 py-0.5 text-[11px] font-medium transition",
                  tagFilter === "chi_cho_vay"
                    ? "bg-sky-600 text-white"
                    : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                )}
              >
                Chi cho vay ({partnerSummary.lentExpensesCount})
              </button>
              <button
                type="button"
                onClick={() => setTagFilter("chi_no")}
                className={cn(
                  "rounded-lg px-2 py-0.5 text-[11px] font-medium transition",
                  tagFilter === "chi_no"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                )}
              >
                Chi nợ ({partnerSummary.borrowedExpensesCount})
              </button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-10 text-center">
              <HandCoins className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs font-medium text-slate-500">
                Không tìm thấy khoản nào theo bộ lọc đã chọn
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isContract = item.source === "contract";
                const isExpense = item.source === "expense";
                const isPositive = item.itemType === "lend" || item.itemType === "lent_spent";

                return (
                  <div
                    key={`${item.source}-${item.id}`}
                    className={cn(
                      "rounded-2xl border p-4 transition-all hover:border-slate-300 shadow-2xs",
                      item.isSettled
                        ? "border-slate-200 bg-slate-50/50 opacity-80"
                        : item.isOverdue
                        ? "border-rose-300 bg-rose-50/30"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    {/* Top Row: Tag badge + Status + Remaining */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* TAG BADGE */}
                        <Badge
                          variant="outline"
                          className={cn("rounded-lg px-2 py-0.5 text-xs font-bold border", item.tagColorClass)}
                        >
                          {item.tagLabel}
                        </Badge>

                        {/* STATUS BADGE */}
                        <Badge
                          variant={item.isOverdue ? "destructive" : item.isSettled ? "secondary" : "outline"}
                          className="rounded-lg text-[10px]"
                        >
                          {item.statusLabel}
                        </Badge>

                        {item.isOverdue && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-600">
                            <ShieldAlert className="h-3 w-3" /> Quá hạn
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] font-medium text-slate-500">
                          {item.isSettled ? "Đã xong: " : "Còn lại: "}
                        </span>
                        <span
                          className={cn(
                            "money-blur text-base font-bold",
                            isPositive ? "text-emerald-700" : "text-rose-700"
                          )}
                        >
                          {formatCurrency(item.isSettled ? item.amount : item.remainingAmount)} {item.currency}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Title, details, metadata */}
                    <div className="mt-2.5">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </h4>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div className="rounded-xl bg-slate-50 p-2">
                          <span className="text-[10px] uppercase font-semibold text-slate-400">
                            Số tiền gốc
                          </span>
                          <p className="money-blur font-bold text-slate-800">
                            {formatCurrency(item.amount)} {item.currency}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-2">
                          <span className="text-[10px] uppercase font-semibold text-slate-400">
                            Ngày phát sinh
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>{formatDate(item.date)}</span>
                          </p>
                        </div>

                        {item.dueDate ? (
                          <div className="rounded-xl bg-slate-50 p-2">
                            <span className="text-[10px] uppercase font-semibold text-slate-400">
                              Hạn trả
                            </span>
                            <p
                              className={cn(
                                "font-semibold flex items-center gap-1",
                                item.isOverdue ? "text-rose-600 font-bold" : "text-slate-800"
                              )}
                            >
                              <Calendar className="h-3 w-3 text-slate-400" />
                              <span>{formatDate(item.dueDate)}</span>
                            </p>
                          </div>
                        ) : item.categoryName ? (
                          <div className="rounded-xl bg-slate-50 p-2">
                            <span className="text-[10px] uppercase font-semibold text-slate-400">
                              Danh mục
                            </span>
                            <p className="font-semibold text-slate-800 truncate">
                              {item.categoryName}
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl bg-slate-50 p-2">
                            <span className="text-[10px] uppercase font-semibold text-slate-400">
                              Hình thức
                            </span>
                            <p className="font-semibold text-slate-800">
                              {isContract ? "Hợp đồng" : "Chi tiền"}
                            </p>
                          </div>
                        )}

                        <div className="rounded-xl bg-slate-50 p-2">
                          <span className="text-[10px] uppercase font-semibold text-slate-400">
                            {item.interest ? "Lãi suất" : item.accountName ? "Tài khoản chi" : "Ghi chú"}
                          </span>
                          <p className="font-semibold text-slate-800 truncate flex items-center gap-1">
                            {item.interest ? (
                              <>
                                <Percent className="h-3 w-3 text-slate-400" />
                                <span>{item.interest}</span>
                              </>
                            ) : item.accountName ? (
                              <span>{item.accountName}</span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-[11px] text-muted-foreground">
                        {isContract ? `Mã hợp đồng: #${item.id.slice(0, 8)}` : `Giao dịch tiền mặt`}
                      </span>

                      {isContract ? (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 rounded-xl text-xs font-semibold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <Link to={`/debts/${item.id}`}>
                            <span>Lịch sử & Ghi nhận trả nợ</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      ) : isExpense ? (
                        <Button
                          size="sm"
                          variant={item.isSettled ? "outline" : "default"}
                          disabled={processingTxId === item.id}
                          onClick={() => handleToggleSettled(item)}
                          className={cn(
                            "h-7 gap-1 rounded-xl text-xs font-semibold",
                            item.isSettled
                              ? "text-slate-600 hover:bg-slate-100"
                              : item.itemType === "lent_spent"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-rose-600 hover:bg-rose-700 text-white"
                          )}
                        >
                          {processingTxId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : item.isSettled ? (
                            <RotateCcw className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          <span>
                            {item.isSettled
                              ? "Chuyển về chưa xong"
                              : item.itemType === "lent_spent"
                              ? "Đánh dấu đã thu"
                              : "Đánh dấu đã trả"}
                          </span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
