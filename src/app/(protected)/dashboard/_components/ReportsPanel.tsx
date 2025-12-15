"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

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
  commission_total: number;
  swap_total: number;
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
  const latestRun = reportRuns?.[0];
  const lastRunLabel = latestRun?.created_at ? formatDateTime(latestRun.created_at) : "Chưa có dữ liệu";
  const winRate = tradingSummary.trade_count ? Math.round((tradingSummary.win_trades / tradingSummary.trade_count) * 100) : 0;
  const tradingFeesLabel = `Commission ${formatMoney(Math.abs(tradingSummary.commission_total))} + Swap ${formatMoney(
    Math.abs(tradingSummary.swap_total)
  )} USD`;
  const fundingBalance = fundingSummary.withdraw_total - fundingSummary.deposit_total;

  return (
    <div className="space-y-6 sm:space-y-7">
      <div className="rounded-3xl bg-gradient-to-r from-slate-100 via-white to-blue-50 p-5 text-slate-900 shadow-xl ring-1 ring-slate-200/80 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Báo cáo</p>
            <p className="text-3xl font-semibold text-slate-900">Dashboard</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
            Cập nhật: {lastRunLabel}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cashflow Net</p>
            <p className="money-blur text-2xl font-semibold text-slate-900">
              {cashflowSummary.net_amount >= 0 ? "+" : ""}
              {formatMoney(cashflowSummary.net_amount)} {defaultCurrency}
            </p>
            <p className="text-xs text-slate-500">{formatDate(cashflowStart)} đến nay</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Trading PnL</p>
            <p className="money-blur text-2xl font-semibold text-slate-900">
              {tradingSummary.pnl_total >= 0 ? "+" : ""}
              {formatMoney(tradingSummary.pnl_total)} USD
            </p>
            <p className="text-xs text-slate-500">Win rate {winRate}%</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-3xl border-none bg-white text-slate-900 shadow-lg shadow-slate-200/70 ring-1 ring-slate-100">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="flex items-center justify-between text-lg font-semibold">
              <span>Cashflow report</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {formatDate(cashflowStart)}
              </span>
            </CardTitle>
            <CardDescription>Liên tục từ ngày báo cáo mới nhất đến hiện tại</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {cashflowHighlights.map((item) => (
                <div key={item.key} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">{item.label}</p>
                  <p className="money-blur text-2xl font-semibold">
                    {formatMoney(cashflowSummary[item.key])} {defaultCurrency}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-emerald-50 to-white p-4">
              <p className="text-xs uppercase text-muted-foreground">Net</p>
              <p className={`money-blur text-3xl font-semibold ${cashflowSummary.net_amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {cashflowSummary.net_amount >= 0 ? "+" : ""}
                {formatMoney(cashflowSummary.net_amount)} {defaultCurrency}
              </p>
              <p className="text-xs text-muted-foreground">{cashflowSummary.transaction_count} giao dịch</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-none bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-sky-50 shadow-lg ring-1 ring-black/10">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="flex items-center justify-between text-lg text-sky-50">
              <span>Trading report</span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-sky-200">
                {formatDate(tradingStart)}
              </span>
            </CardTitle>
            <CardDescription className="text-sky-200">Orders closed từ ngày báo cáo mới đến nay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-sky-200">PnL tổng (USD)</p>
              <p className={`money-blur text-3xl font-semibold ${tradingSummary.pnl_total >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {tradingSummary.pnl_total >= 0 ? "+" : ""}
                {formatMoney(tradingSummary.pnl_total)} USD
              </p>
              <p className="text-xs uppercase tracking-wide text-sky-200">Win rate {winRate}%</p>
              <p className="text-xs text-sky-200">{tradingFeesLabel}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs uppercase tracking-wide text-sky-200">
              <div className="rounded-2xl border border-white/15 bg-white/5 px-2 py-2">
                <p className="text-[10px]">Wins</p>
                <strong className="text-base text-emerald-300">{tradingSummary.win_trades}</strong>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 px-2 py-2">
                <p className="text-[10px]">Losses</p>
                <strong className="text-base text-rose-300">{tradingSummary.loss_trades}</strong>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 px-2 py-2">
                <p className="text-[10px]">Trades</p>
                <strong className="text-base text-sky-50">{tradingSummary.trade_count}</strong>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-sky-100">
              Trung bình mỗi trade: <span className="money-blur">{formatMoney(tradingSummary.average_pnl)} {defaultCurrency}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-3xl border-none bg-white text-slate-900 shadow-lg shadow-slate-200/70 ring-1 ring-slate-100">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Funding report</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              {formatDate(fundingStart)}
            </span>
          </CardTitle>
          <CardDescription>Funding history từ ngày báo cáo mới nhất</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            {fundingHighlights.map((item) => (
              <div key={item.key} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <p className="text-xs uppercase text-muted-foreground">{item.label}</p>
                <p className="money-blur text-2xl font-semibold">
                  {formatMoney(fundingSummary[item.key])}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-blue-50 to-white p-4">
            <p className="text-xs uppercase text-muted-foreground">Net</p>
            <p className={`money-blur text-3xl font-semibold ${fundingBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fundingBalance >= 0 ? "+" : ""}
              {formatMoney(fundingBalance)}
            </p>
            <p className="text-xs text-muted-foreground">{fundingSummary.transaction_count} giao dịch</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
