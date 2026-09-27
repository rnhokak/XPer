import { useSearchParams } from "react-router-dom";
import { normalizeCashflowRange, normalizeRangeShift } from "@/lib/cashflow/utils";
import { PieChart, RefreshCw } from "lucide-react";
import { TransactionByCategoryReport } from "./components/TransactionByCategoryReport";
import { useAuth } from "@/hooks/useAuth";
import { useReportsData } from "@/hooks/useReportsData";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const range = normalizeCashflowRange(searchParams.get("range") ?? undefined);
  const shift = normalizeRangeShift(searchParams.get("shift") ?? undefined);

  const { data, isLoading, error, refetch } = useReportsData(range, shift, user?.id ?? "");

  if (authLoading || isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-6 px-4">
        <div className="space-y-2">
          <div className="h-8 w-64 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-4 w-96 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="h-96 animate-pulse rounded-3xl bg-slate-100" />
          <div className="h-96 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center rounded-3xl border border-dashed border-rose-200 bg-rose-50/40 p-8 text-center my-12">
        <span className="text-3xl mb-2">⚠️</span>
        <h3 className="text-base font-bold text-slate-800">Không thể tải dữ liệu báo cáo</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Đã xảy ra sự cố khi tải lịch sử giao dịch và danh mục. Vui lòng thử lại.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="mt-4 rounded-xl border-slate-200 bg-white"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Tải lại
        </Button>
      </div>
    );
  }

  const transactions = data?.transactions ?? [];
  const categories = data?.categories ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-x-hidden pb-12">
      {/* Header section */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xs">
              <PieChart className="h-4 w-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Báo cáo theo danh mục
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Phân tích chi tiết cơ cấu dòng tiền, tỷ trọng chi tiêu và nguồn thu nhập theo danh mục.
          </p>
        </div>
      </div>

      {/* Main Report Dashboard */}
      <TransactionByCategoryReport
        transactions={transactions}
        categories={categories}
        range={range}
        shift={shift}
      />
    </div>
  );
}
