"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeRangeShift } from "@/lib/cashflow/utils";
import { Calendar, ChevronLeft, ChevronRight, X, AlertCircle } from "lucide-react";

type Props = {
  value: string;
  customRange?: { from: string; to: string };
};

const formatDateDisplay = (dateStr: string) => {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const MAX_DAYS = 93; // Approximately 3 months

export function CashflowRangeFilter({ value, customRange }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  // Custom date range dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentShift = normalizeRangeShift(searchParams.get("shift"));
  const isCustomActive = Boolean(customRange?.from && customRange?.to);

  const openCustomDialog = () => {
    const today = new Date().toISOString().slice(0, 10);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const defaultFrom = threeMonthsAgo.toISOString().slice(0, 10);

    setFromInput(customRange?.from ?? defaultFrom);
    setToInput(customRange?.to ?? today);
    setDateError(null);
    setIsDialogOpen(true);
  };

  const handleDateChange = (fromVal: string, toVal: string) => {
    setFromInput(fromVal);
    setToInput(toVal);

    if (!fromVal || !toVal) {
      setDateError(null);
      return;
    }

    const fromDate = new Date(`${fromVal}T00:00:00`);
    const toDate = new Date(`${toVal}T00:00:00`);

    if (toDate < fromDate) {
      setDateError("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
      return;
    }

    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_DAYS) {
      setDateError("Khoảng thời gian tìm kiếm tối đa là 3 tháng (93 ngày)");
      return;
    }

    setDateError(null);
  };

  const applyCustomRange = () => {
    if (!fromInput || !toInput) return;

    const fromDate = new Date(`${fromInput}T00:00:00`);
    const toDate = new Date(`${toInput}T00:00:00`);

    if (toDate < fromDate) {
      setDateError("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
      return;
    }

    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_DAYS) {
      setDateError("Khoảng thời gian tìm kiếm tối đa là 3 tháng (93 ngày)");
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.set("from", fromInput);
    params.set("to", toInput);
    params.delete("range");
    params.delete("shift");
    const qs = params.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    startTransition(() => navigate(url, { replace: true }));
    setIsDialogOpen(false);
  };

  const resetToCurrentMonth = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("from");
    params.delete("to");
    params.delete("range");
    params.delete("shift");
    const qs = params.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    startTransition(() => navigate(url, { replace: true }));
  };

  const updateRange = (next: string) => {
    if (next === "custom") {
      openCustomDialog();
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.delete("from");
    params.delete("to");
    params.set("range", next);
    params.delete("shift");
    const qs = params.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    startTransition(() => navigate(url, { replace: true }));
  };

  const updateShift = (delta: number) => {
    const nextShift = currentShift + delta;
    const params = new URLSearchParams(searchParams);
    params.delete("from");
    params.delete("to");
    params.set("range", value || "month");
    if (nextShift === 0) {
      params.delete("shift");
    } else {
      params.set("shift", String(nextShift));
    }
    const qs = params.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    startTransition(() => navigate(url, { replace: true }));
  };

  if (!mounted) {
    return (
      <div className="h-9 w-[180px] animate-pulse rounded-md border bg-muted/50" aria-hidden="true" />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isCustomActive ? (
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-sm">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-slate-700">
            {formatDateDisplay(customRange!.from)} - {formatDateDisplay(customRange!.to)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openCustomDialog}
            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Đổi
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetToCurrentMonth}
            title="Trở về tháng hiện tại"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateShift(-1)}
            title="Kỳ trước"
            className="h-9 w-9 p-0 bg-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={value} onValueChange={updateRange}>
            <SelectTrigger className="w-[145px] sm:w-[155px] h-9 bg-white text-xs sm:text-sm font-medium">
              <SelectValue placeholder="Khoảng thời gian" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Tháng này</SelectItem>
              <SelectItem value="today">Hôm nay</SelectItem>
              <SelectItem value="week">Tuần này</SelectItem>
              <SelectItem value="custom">
                <div className="flex items-center gap-1.5 text-primary font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Khoảng ngày...</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateShift(1)}
            title="Kỳ sau"
            className="h-9 w-9 p-0 bg-white"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Date Range Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Chọn khoảng ngày tìm kiếm
            </DialogTitle>
            <DialogDescription>
              Xem giao dịch theo khoảng ngày tùy chọn (tối đa 3 tháng / 93 ngày).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from-date" className="text-xs font-semibold">
                  Từ ngày
                </Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromInput}
                  onChange={(e) => handleDateChange(e.target.value, toInput)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to-date" className="text-xs font-semibold">
                  Đến ngày
                </Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toInput}
                  onChange={(e) => handleDateChange(fromInput, e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {dateError && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{dateError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDialogOpen(false);
                resetToCurrentMonth();
              }}
            >
              Về tháng hiện tại
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={Boolean(dateError) || !fromInput || !toInput}
              onClick={applyCustomRange}
            >
              Áp dụng tìm kiếm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
