"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotificationsStore } from "@/store/notifications";
import { reportTypes, type ReportType } from "@/lib/validation/report";
import type { Database } from "@/lib/supabase/types";

const typeLabels: Record<ReportType, string> = {
  cashflow: "Cashflow",
  trading: "Trading",
  funding: "Funding",
};

type ReportRunRow = Database["public"]["Tables"]["report_runs"]["Row"];

type CashflowSummary = {
  total_income: number;
  total_expense: number;
  net_amount: number;
  transaction_count: number;
};

type TradingSummary = {
  pnl_total: number;
  win_trades: number;
  loss_trades: number;
  neutral_trades: number;
  trade_count: number;
  average_pnl: number;
};

type FundingSummary = {
  deposit_total: number;
  withdraw_total: number;
  net_amount: number;
  transaction_count: number;
};

type Props = {
  reportRuns: ReportRunRow[];
  cashflowSummary: CashflowSummary;
  tradingSummary: TradingSummary;
  cashflowStart: string;
  tradingStart: string;
  fundingSummary: FundingSummary;
  fundingStart: string;
  defaultCurrency: string;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value);

const cashflowHighlights = [
  { label: "Thu", key: "total_income" as const },
  { label: "Chi", key: "total_expense" as const },
];

const fundingHighlights = [
  { label: "Deposits", key: "deposit_total" as const },
  { label: "Withdraws", key: "withdraw_total" as const },
];

export default function ReportsPanel({
  reportRuns,
  cashflowSummary,
  tradingSummary,
  cashflowStart,
  tradingStart,
  fundingSummary,
  fundingStart,
  defaultCurrency,
}: Props) {

  console.log("Rendering ReportsPanel with reportRuns:", reportRuns);
  console.log("cashflowSummary:", cashflowSummary);
  console.log("tradingSummary:", tradingSummary);
  console.log("fundingSummary:", fundingSummary);
  const router = useRouter();
  const notify = useNotificationsStore((state) => state.notify);
  const todayValue = new Date().toISOString().slice(0, 10);
  const [formState, setFormState] = useState<{ type: ReportType; reportDate: string }>({
    type: reportTypes[0],
    reportDate: todayValue,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/report-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formState.type,
          report_date: formState.reportDate,
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((json as { error?: string })?.error ?? "Không thể lưu báo cáo");
      }

      notify({
        type: "success",
        title: "Đã ghi nhận ngày báo cáo",
        description: `Bắt đầu từ ${formatDate(formState.reportDate)}`,
      });
      setFormState((prev) => ({ ...prev, reportDate: todayValue }));
      router.refresh();
    } catch (error: any) {
      notify({
        type: "error",
        title: "Thất bại",
        description: error?.message ?? "Không thể lưu báo cáo",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const rowsToShow = reportRuns.slice(0, 12);
  const winRate = tradingSummary.trade_count ? Math.round((tradingSummary.win_trades / tradingSummary.trade_count) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.03fr,0.97fr]">
        <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Cashflow report</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{formatDate(cashflowStart)}</span>
            </CardTitle>
            <CardDescription>Liên tục từ ngày báo cáo mới nhất đến hiện tại</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {cashflowHighlights.map((item) => (
                <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-semibold">
                    {formatMoney(cashflowSummary[item.key])} {defaultCurrency}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase text-muted-foreground">Net</p>
              <p className={`text-3xl font-semibold ${cashflowSummary.net_amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {cashflowSummary.net_amount >= 0 ? "+" : ""}
                {formatMoney(cashflowSummary.net_amount)} {defaultCurrency}
              </p>
              <p className="text-xs text-muted-foreground">{cashflowSummary.transaction_count} giao dịch</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Trading report</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{formatDate(tradingStart)}</span>
            </CardTitle>
            <CardDescription>Orders closed từ ngày báo cáo mới đến nay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase text-muted-foreground">PnL tổng</p>
              <p className={`text-3xl font-semibold ${tradingSummary.pnl_total >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {tradingSummary.pnl_total >= 0 ? "+" : ""}
                {formatMoney(tradingSummary.pnl_total)} {defaultCurrency}
              </p>
              <p className="text-xs text-muted-foreground">Win rate {winRate}%</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
              <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-slate-900">
                <p className="text-[10px]">Wins</p>
                <strong className="text-base text-emerald-600">{tradingSummary.win_trades}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-slate-900">
                <p className="text-[10px]">Losses</p>
                <strong className="text-base text-red-600">{tradingSummary.loss_trades}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-slate-900">
                <p className="text-[10px]">Trades</p>
                <strong className="text-base text-foreground">{tradingSummary.trade_count}</strong>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-muted-foreground">
              Trung bình mỗi trade: {formatMoney(tradingSummary.average_pnl)} {defaultCurrency}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Funding report</span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{formatDate(fundingStart)}</span>
          </CardTitle>
          <CardDescription>Funding history từ ngày báo cáo mới nhất</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fundingHighlights.map((item) => (
              <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-semibold">
                  {formatMoney(fundingSummary[item.key])} {defaultCurrency}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-muted-foreground">Net</p>
            <p className={`text-3xl font-semibold ${fundingSummary.net_amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fundingSummary.net_amount >= 0 ? "+" : ""}
              {formatMoney(fundingSummary.net_amount)} {defaultCurrency}
            </p>
            <p className="text-xs text-muted-foreground">{fundingSummary.transaction_count} giao dịch</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Bảng ngày báo cáo</CardTitle>
              <CardDescription>Ghi lại thời điểm bắt đầu báo cáo mới theo loại.</CardDescription>
            </div>
            <div className="text-xs text-muted-foreground">Danh sách mới nhất</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Ngày bắt đầu</th>
                  <th className="px-4 py-3">Ghi nhận lúc</th>
                </tr>
              </thead>
              <tbody>
                {rowsToShow.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-5 text-center text-sm text-muted-foreground">
                      Chưa có ngày báo cáo nào.
                    </td>
                  </tr>
                ) : (
                  rowsToShow.map((run) => (
                    <tr key={run.id} className="border-t border-slate-100 bg-white/80">
                      <td className="px-4 py-3 text-foreground">{typeLabels[run.type]}</td>
                      <td className="px-4 py-3">{formatDate(run.report_date)}</td>
                      <td className="px-4 py-3">{formatDateTime(run.created_at ?? run.report_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <form className="grid gap-3 md:grid-cols-[1fr,1fr,auto]" onSubmit={handleSubmit}>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Loại báo cáo</p>
              <Select
                value={formState.type}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, type: value as ReportType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Ngày báo cáo</p>
              <Input
                type="date"
                value={formState.reportDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, reportDate: event.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? "Đang lưu..." : "Ghi nhận"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
