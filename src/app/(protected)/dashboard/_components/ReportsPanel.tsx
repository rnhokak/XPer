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

  const winRate = tradingSummary.trade_count ? Math.round((tradingSummary.win_trades / tradingSummary.trade_count) * 100) : 0;
  const tradingFeesLabel = `Commission ${formatMoney(Math.abs(tradingSummary.commission_total))} + Swap ${formatMoney(
    Math.abs(tradingSummary.swap_total)
  )} USD`;
  const fundingBalance = fundingSummary.withdraw_total - fundingSummary.deposit_total;

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
              <p className="text-xs uppercase text-muted-foreground">PnL tổng (USD)</p>
              <p className={`text-3xl font-semibold ${tradingSummary.pnl_total >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {tradingSummary.pnl_total >= 0 ? "+" : ""}
                {formatMoney(tradingSummary.pnl_total)} USD
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Win rate {winRate}%</p>
              <p className="text-xs text-muted-foreground">{tradingFeesLabel}</p>
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
            <p className={`text-3xl font-semibold ${fundingBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fundingBalance >= 0 ? "+" : ""}
              {formatMoney(fundingBalance)} {defaultCurrency}
              </p>
              <p className="text-xs text-muted-foreground">{fundingSummary.transaction_count} giao dịch</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
