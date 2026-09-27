import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@/lib/query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type DebtRow } from "@/hooks/useDebtsData";
import { type CashflowAccount } from "@/hooks/useCashflowTransactions";
import { apiClient } from "@/lib/api/client";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Info,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (val: number, currency = "VND") =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(val)) + " " + currency;

export type TransferAllocation = {
  debtId: string;
  direction: "lend" | "borrow";
  partnerName: string;
  principalAmount: number;
  remaining: number;
  allocated: number;
};

/** FIFO allocation: distribute `totalAmount` across active debts oldest-first */
export function computeFifoAllocations(
  activeDebts: DebtRow[],
  totalAmount: number
): TransferAllocation[] {
  // Sort oldest first by start_date
  const sorted = [...activeDebts].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  let remaining = totalAmount;
  return sorted.map((debt) => {
    const debtRemaining = debt.outstanding_principal ?? debt.principal_amount ?? 0;
    const allocated = Math.min(remaining, debtRemaining);
    remaining = Math.max(0, remaining - allocated);
    return {
      debtId: debt.id,
      direction: debt.direction,
      partnerName: debt.partner?.name ?? "—",
      principalAmount: debt.principal_amount,
      remaining: debtRemaining,
      allocated,
    };
  });
}

type Props = {
  /** Active (non-settled) debts for this partner */
  activeDebts: DebtRow[];
  netBalance: number;
  totalLendOutstanding: number;
  totalBorrowOutstanding: number;
  accounts: CashflowAccount[];
  currency: string;
  defaultAccountId?: string;
};

const EMPTY = "__none__";

export function PartnerTransferForm({
  activeDebts,
  netBalance,
  totalLendOutstanding,
  totalBorrowOutstanding,
  accounts,
  currency,
  defaultAccountId,
}: Props) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId ?? EMPTY);
  const [note, setNote] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedAmount = useMemo(() => {
    const n = parseFloat(amount.replace(/,/g, ""));
    return isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  // Only show active debts with outstanding balance
  const relevantDebts = useMemo(
    () => activeDebts.filter((d) => (d.outstanding_principal ?? d.principal_amount ?? 0) > 0),
    [activeDebts]
  );

  const allocations = useMemo(
    () => (parsedAmount > 0 ? computeFifoAllocations(relevantDebts, parsedAmount) : []),
    [relevantDebts, parsedAmount]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      // POST each allocation as a debt payment
      for (const alloc of allocations) {
        if (alloc.allocated <= 0) continue;
        await apiClient.post("/debts/payments", {
          debt_id: alloc.debtId,
          amount: alloc.allocated,
          principal_amount: alloc.allocated,
          interest_amount: 0,
          account_id: accountId === EMPTY ? null : accountId,
          payment_date: new Date().toISOString(),
          note: note.trim() || null,
          currency,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      setSubmitState("success");
      setAmount("");
      setNote("");
      setTimeout(() => setSubmitState("idle"), 3000);
    },
    onError: (err) => {
      setSubmitState("error");
      setErrorMsg(err instanceof Error ? err.message : "Không thể ghi nhận chuyển khoản");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0 || relevantDebts.length === 0) return;
    setSubmitState("loading");
    setErrorMsg(null);
    mutation.mutate();
  };

  const isNetLending = netBalance > 0;
  const isNetBorrowing = netBalance < 0;
  const hasActiveDebts = relevantDebts.length > 0;

  return (
    <div className="space-y-5">
      {/* Summary banner */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs">
        <div className="text-center">
          <span className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            <ArrowUpRight className="h-3 w-3 text-emerald-600" /> Họ nợ bạn
          </span>
          <p className="mt-0.5 font-bold text-emerald-700">{fmt(totalLendOutstanding, currency)}</p>
        </div>
        <div className="text-center">
          <span className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-800">
            <ArrowDownLeft className="h-3 w-3 text-rose-600" /> Bạn nợ họ
          </span>
          <p className="mt-0.5 font-bold text-rose-700">{fmt(totalBorrowOutstanding, currency)}</p>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Bù trừ ròng</span>
          <p
            className={cn(
              "mt-0.5 font-bold",
              isNetLending ? "text-emerald-700" : isNetBorrowing ? "text-rose-700" : "text-slate-700"
            )}
          >
            {isNetLending ? "+" : isNetBorrowing ? "-" : ""}
            {fmt(Math.abs(netBalance), currency)}
          </p>
        </div>
      </div>

      {!hasActiveDebts ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          <p className="text-sm font-semibold text-slate-700">Tất cả khoản vay đã tất toán!</p>
          <p className="text-xs text-muted-foreground">Không có khoản nợ nào cần thanh toán với đối tác này.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-800">Số tiền chuyển</label>
            <div className="relative">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-12 rounded-xl border-slate-200 pr-14 text-base font-bold"
                inputMode="numeric"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                {currency}
              </span>
            </div>
          </div>

          {/* Account selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-800">Tài khoản nguồn</label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="Chọn tài khoản" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY}>Không chọn tài khoản</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-800">Ghi chú</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tuỳ chọn..."
              className="h-10 rounded-xl border-slate-200"
            />
          </div>

          {/* FIFO Allocation Preview */}
          {parsedAmount > 0 && allocations.length > 0 && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                <Info className="h-3.5 w-3.5" />
                <span>Phân bổ tự động (từ cũ đến mới)</span>
              </div>
              <div className="space-y-1.5">
                {allocations.map((alloc, i) => (
                  <div key={alloc.debtId} className="flex items-center gap-2 text-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-[10px] font-bold text-blue-800">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            "rounded px-1 text-[10px] font-bold",
                            alloc.direction === "lend"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          )}
                        >
                          {alloc.direction === "lend" ? "Cho vay" : "Đi vay"}
                        </span>
                        <span className="truncate font-medium text-slate-700">
                          Còn {fmt(alloc.remaining, currency)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span
                        className={cn(
                          "font-bold",
                          alloc.allocated === alloc.remaining ? "text-emerald-700" : "text-blue-700"
                        )}
                      >
                        Trả {fmt(alloc.allocated, currency)}
                        {alloc.allocated === alloc.remaining && (
                          <span className="ml-1 text-[10px]">(tất toán)</span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error / Success */}
          {submitState === "error" && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg || "Có lỗi xảy ra. Thử lại sau."}</span>
            </div>
          )}
          {submitState === "success" && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Đã ghi nhận thanh toán thành công!</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={parsedAmount <= 0 || submitState === "loading"}
            className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-semibold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20"
          >
            {submitState === "loading" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang ghi nhận...
              </>
            ) : (
              <>Xác nhận chuyển khoản · {parsedAmount > 0 ? fmt(parsedAmount, currency) : "—"}</>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
