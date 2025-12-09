"use client";

import { useMemo } from "react";
import { Wallet, ArrowUpRight, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/types";

type LatestBalanceRow = Database["public"]["Views"]["balance_account_latest_balances"]["Row"];
type SnapshotRow = Database["public"]["Tables"]["trading_daily_balance_snapshots"]["Row"];

type Props = {
  latestBalances: LatestBalanceRow[];
  snapshots: SnapshotRow[];
  loadError?: string | null;
};

const currencyFmt = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

const todayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const monthStartISO = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const buildSeries = (snapshots: SnapshotRow[], days = 30) => {
  const map = new Map<string, number>();
  snapshots.forEach((s) => {
    map.set(s.date, (map.get(s.date) ?? 0) + Number(s.closing_balance ?? 0));
  });

  const series: { date: string; value: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, value: map.get(key) ?? 0 });
  }
  return series;
};

export default function TradingDashboardPageClient({ latestBalances, snapshots, loadError }: Props) {
  const today = todayISO();
  const monthStart = monthStartISO();

  const metrics = useMemo(() => {
    const map = new Map<
      string,
      {
        todayChange: number;
        mtdChange: number;
        openingMonth: number;
      }
    >();

    latestBalances.forEach((bal) => {
      const snaps = snapshots.filter((s) => s.balance_account_id === bal.balance_account_id);
      const todaySnap = snaps.find((s) => s.date === today);

      const prevMonthSnap = snaps
        .filter((s) => s.date < monthStart)
        .sort((a, b) => (a.date > b.date ? -1 : 1))[0];

      const monthOpening = prevMonthSnap?.closing_balance ?? 0;
      const currentBalance = Number(bal.current_balance ?? 0);
      const todayClosing = todaySnap?.closing_balance ?? currentBalance;
      const todayOpening = todaySnap?.opening_balance ?? monthOpening;

      map.set(bal.balance_account_id ?? "", {
        todayChange: todayClosing - todayOpening,
        mtdChange: currentBalance - monthOpening,
        openingMonth: monthOpening,
      });
    });

    return map;
  }, [latestBalances, snapshots, today, monthStart]);

  const totals = useMemo(() => {
    const totalBalance = latestBalances.reduce((sum, b) => sum + Number(b.current_balance ?? 0), 0);
    const totalToday = latestBalances.reduce(
      (sum, b) => sum + (metrics.get(b.balance_account_id ?? "")?.todayChange ?? 0),
      0
    );
    const totalMtd = latestBalances.reduce(
      (sum, b) => sum + (metrics.get(b.balance_account_id ?? "")?.mtdChange ?? 0),
      0
    );
    return { totalBalance, totalToday, totalMtd };
  }, [latestBalances, metrics]);

  const series30d = useMemo(() => buildSeries(snapshots, 30), [snapshots]);
  const series7d = useMemo(() => buildSeries(snapshots, 7), [snapshots]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Trading · Balance Accounts</p>
          <h1 className="text-2xl font-semibold">Balance dashboard</h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{currencyFmt(totals.totalBalance, latestBalances[0]?.currency ?? "USD")}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Today change</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            {totals.totalToday >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <p className={`text-2xl font-semibold ${totals.totalToday >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {totals.totalToday >= 0 ? "+" : ""}
              {currencyFmt(totals.totalToday, latestBalances[0]?.currency ?? "USD")}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">MTD change</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            {totals.totalMtd >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <p className={`text-2xl font-semibold ${totals.totalMtd >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {totals.totalMtd >= 0 ? "+" : ""}
              {currencyFmt(totals.totalMtd, latestBalances[0]?.currency ?? "USD")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="7 ngày gần nhất (tổng tất cả tài khoản)" series={series7d} />
        <ChartCard title="30 ngày (tổng tất cả tài khoản)" series={series30d} />
      </div>

      {loadError ? (
        <Card>
          <CardHeader>
            <CardTitle>Lỗi tải dữ liệu</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {latestBalances.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Chưa có balance account</CardTitle>
              <CardDescription>Tạo Trading/Funding balance account trước.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          latestBalances.map((acc) => {
            const metric = metrics.get(acc.balance_account_id ?? "") ?? { todayChange: 0, mtdChange: 0, openingMonth: 0 };
            const balance = Number(acc.current_balance ?? 0);
            const currency = acc.currency ?? "USD";
            const isTrading = acc.account_type === "TRADING";
            const changeColorToday = metric.todayChange >= 0 ? "text-emerald-600" : "text-red-600";
            const changeColorMtd = metric.mtdChange >= 0 ? "text-emerald-600" : "text-red-600";

            return (
              <Card key={acc.balance_account_id ?? acc.name} className="shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-primary" />
                      {acc.name}
                    </CardTitle>
                    <CardDescription>{isTrading ? "Trading account" : "Funding account"}</CardDescription>
                  </div>
                  <Badge variant={isTrading ? "default" : "secondary"}>{acc.account_type}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Current balance</p>
                    <p className="text-2xl font-semibold">{currencyFmt(balance, currency)}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground/80">Today change</p>
                      <div className="flex items-center gap-2">
                        {metric.todayChange >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <p className={`text-lg font-semibold ${changeColorToday}`}>
                          {metric.todayChange >= 0 ? "+" : ""}
                          {currencyFmt(metric.todayChange, currency)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-slate-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground/80">MTD change</p>
                      <div className="flex items-center gap-2">
                        {metric.mtdChange >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <p className={`text-lg font-semibold ${changeColorMtd}`}>
                          {metric.mtdChange >= 0 ? "+" : ""}
                          {currencyFmt(metric.mtdChange, currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Last ledger at: {acc.balance_at ? new Date(acc.balance_at).toLocaleString() : "N/A"}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, series }: { title: string; series: { date: string; value: number }[] }) {
  const values = series.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const height = 120;
  const width = 260;
  const points = series
    .map((p, idx) => {
      const x = (idx / Math.max(series.length - 1, 1)) * width;
      const normalized = (p.value - min) / (max - min || 1);
      const y = height - normalized * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart2 className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu snapshot.</p>
        ) : (
          <div className="space-y-2">
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
              <polyline
                fill="none"
                stroke="var(--chart-line, #10b981)"
                strokeWidth="2"
                points={points}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {series.map((p, idx) => {
                const x = (idx / Math.max(series.length - 1, 1)) * width;
                const normalized = (p.value - min) / (max - min || 1);
                const y = height - normalized * height;
                return <circle key={p.date} cx={x} cy={y} r={2.5} fill="#0ea5e9" />;
              })}
            </svg>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{series[0]?.date ?? ""}</span>
              <span>{series[series.length - 1]?.date ?? ""}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
