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
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  ExternalLink,
  HandCoins,
  Percent,
  Phone,
  Plus,
  ShieldAlert,
  ShoppingBag,
  User,
} from "lucide-react";
import { DebtExpensesTracker } from "./DebtExpensesTracker";
import { cn } from "@/lib/utils";

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
  activeDebtsCount: number;
  settledDebtsCount: number;
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

const statusVariant = (status: DebtRow["status"]) => {
  switch (status) {
    case "paid_off":
      return "default";
    case "overdue":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
};

const statusLabel = (status: DebtRow["status"]) => {
  switch (status) {
    case "paid_off":
      return "Đã tất toán";
    case "overdue":
      return "Quá hạn";
    case "cancelled":
      return "Đã hủy";
    default:
      return "Đang thực hiện";
  }
};

export function PartnerDebtsDetailDialog({
  open,
  onClose,
  partnerSummary,
  currency = "VND",
}: Props) {
  const [detailTab, setDetailTab] = useState<"debts" | "expenses">("debts");
  const [filterMode, setFilterMode] = useState<"all" | "active" | "settled">("all");

  if (!partnerSummary) return null;

  const isBusiness =
    partnerSummary.partnerType?.toLowerCase().includes("doanh nghiệp") ||
    partnerSummary.partnerType?.toLowerCase().includes("công ty") ||
    partnerSummary.partnerType?.toLowerCase().includes("ngân hàng");

  const isNetLending = partnerSummary.netBalance > 0;
  const isNetBorrowing = partnerSummary.netBalance < 0;

  const filteredDebts = partnerSummary.debts.filter((d) => {
    if (filterMode === "active") return d.status !== "paid_off" && d.status !== "cancelled";
    if (filterMode === "settled") return d.status === "paid_off";
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-0 rounded-3xl border-slate-200">
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

              <Button asChild size="sm" className="h-8 gap-1 rounded-xl bg-emerald-600 text-xs hover:bg-emerald-700">
                <Link to="/debts/new">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Khoản vay mới</span>
                </Link>
              </Button>
            </div>
            <DialogDescription className="sr-only">
              Chi tiết các khoản vay và cho vay của {partnerSummary.partnerName}
            </DialogDescription>
          </DialogHeader>

          {/* Partner Balance Summary Box */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {/* Vị thế bù trừ ròng */}
            <div
              className={cn(
                "rounded-2xl border p-3.5 sm:col-span-3",
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
                  ? `Sau khi bù trừ tất cả các khoản, ${partnerSummary.partnerName} còn nợ bạn số tiền trên.`
                  : isNetBorrowing
                  ? `Sau khi bù trừ tất cả các khoản, bạn còn nợ ${partnerSummary.partnerName} số tiền trên.`
                  : `Không có dư nợ chưa thanh toán với ${partnerSummary.partnerName}.`}
              </p>
            </div>

            {/* Chi tiết cho vay */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:col-span-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> Cho vay (Phải thu)
              </span>
              <p className="money-blur mt-1 text-lg font-bold text-emerald-700">
                {formatCurrency(partnerSummary.totalLendOutstanding)} {currency}
              </p>
              <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Gốc ban đầu:</span>
                <span className="money-blur font-medium">
                  {formatCurrency(partnerSummary.totalLendOriginal)} {currency}
                </span>
              </div>
            </div>

            {/* Chi tiết đi vay */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:col-span-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-800 flex items-center gap-1">
                <ArrowDownLeft className="h-3.5 w-3.5 text-rose-600" /> Đi vay (Phải trả)
              </span>
              <p className="money-blur mt-1 text-lg font-bold text-rose-700">
                {formatCurrency(partnerSummary.totalBorrowOutstanding)} {currency}
              </p>
              <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Gốc ban đầu:</span>
                <span className="money-blur font-medium">
                  {formatCurrency(partnerSummary.totalBorrowOriginal)} {currency}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation: Hợp đồng vay vs Chi mua hộ / Vay tiêu */}
        <div className="flex items-center gap-4 border-b border-slate-200/80 px-5 pt-3 sm:px-6">
          <button
            type="button"
            onClick={() => setDetailTab("debts")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 pb-2.5 text-xs sm:text-sm font-semibold transition",
              detailTab === "debts"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <HandCoins className="h-3.5 w-3.5" />
            <span>Hợp đồng vay ({partnerSummary.debts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDetailTab("expenses")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 pb-2.5 text-xs sm:text-sm font-semibold transition",
              detailTab === "expenses"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Chi mua hộ & Vay tiêu</span>
          </button>
        </div>

        {/* Content: List of debts or DebtExpensesTracker */}
        <div className="p-5 sm:p-6 space-y-4">
          {detailTab === "expenses" ? (
            <DebtExpensesTracker
              currency={currency}
              filterPartnerName={partnerSummary.partnerName}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Danh sách hợp đồng ({partnerSummary.debts.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Tất cả các hợp đồng vay và cho vay liên quan
                  </p>
                </div>

                {/* Filter mode */}
                <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-semibold transition active:scale-95",
                  filterMode === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Tất cả ({partnerSummary.debts.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("active")}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-semibold transition active:scale-95",
                  filterMode === "active" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Đang nợ ({partnerSummary.activeDebtsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("settled")}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-semibold transition active:scale-95",
                  filterMode === "settled" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Đã xong ({partnerSummary.settledDebtsCount})
              </button>
            </div>
          </div>

          {filteredDebts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-8 text-center">
              <HandCoins className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs font-medium text-slate-500">
                Không tìm thấy khoản vay nào theo bộ lọc đã chọn
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDebts.map((debt) => {
                const isLend = debt.direction === "lend";
                const isPaidOff = debt.status === "paid_off";
                const remaining = debt.outstanding_principal ?? debt.principal_amount ?? 0;
                const dueDate = debt.due_date ? new Date(debt.due_date) : null;
                const isOverdue =
                  dueDate && dueDate.getTime() < Date.now() && debt.status !== "paid_off";

                return (
                  <div
                    key={debt.id}
                    className={cn(
                      "rounded-2xl border p-4 transition-all hover:border-slate-300 shadow-2xs",
                      isPaidOff
                        ? "border-slate-200 bg-slate-50/50 opacity-80"
                        : isOverdue
                        ? "border-rose-300 bg-rose-50/30"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    {/* Top Row: Type Badge + Status + Remaining */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isLend ? "secondary" : "outline"}
                          className={cn(
                            "rounded-lg text-xs font-semibold",
                            isLend
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                              : "bg-rose-100 text-rose-800 hover:bg-rose-100 border-0"
                          )}
                        >
                          {isLend ? "Cho vay" : "Đi vay"}
                        </Badge>
                        <Badge variant={statusVariant(debt.status)} className="rounded-lg text-[10px]">
                          {statusLabel(debt.status)}
                        </Badge>
                        {isOverdue && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-600">
                            <ShieldAlert className="h-3 w-3" /> Quá hạn
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] font-medium text-slate-500">Còn lại: </span>
                        <span
                          className={cn(
                            "money-blur text-base font-bold",
                            isLend ? "text-emerald-700" : "text-rose-700"
                          )}
                        >
                          {formatCurrency(remaining)} {debt.currency}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Principal & Details */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          Gốc ban đầu
                        </span>
                        <p className="money-blur font-bold text-slate-800">
                          {formatCurrency(debt.principal_amount)} {debt.currency}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          Ngày bắt đầu
                        </span>
                        <p className="font-semibold text-slate-800 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{formatDate(debt.start_date)}</span>
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          Hạn trả
                        </span>
                        <p
                          className={cn(
                            "font-semibold flex items-center gap-1",
                            isOverdue ? "text-rose-600 font-bold" : "text-slate-800"
                          )}
                        >
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{formatDate(debt.due_date)}</span>
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          Lãi suất
                        </span>
                        <p className="font-semibold text-slate-800 flex items-center gap-1">
                          <Percent className="h-3 w-3 text-slate-400" />
                          <span>
                            {debt.interest_type === "none" || !debt.interest_rate
                              ? "Không lãi"
                              : `${debt.interest_rate}% / ${debt.interest_cycle || "tháng"}`}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Description if present */}
                    {debt.description && (
                      <p className="mt-2.5 text-xs text-slate-600 italic">
                        &quot;{debt.description}&quot;
                      </p>
                    )}

                    {/* Bottom Action: Link to Debt Detail page for payments */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-[11px] text-muted-foreground">
                        Mã khoản: #{debt.id.slice(0, 8)}
                      </span>
                      <Button asChild size="sm" variant="ghost" className="h-7 gap-1 rounded-xl text-xs font-semibold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700">
                        <Link to={`/debts/${debt.id}`}>
                          <span>Lịch sử trả nợ & Ghi nhận</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
