"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCashflowTransactions, type CashflowTransaction } from "@/hooks/useCashflowTransactions";

type Transaction = CashflowTransaction;

const formatNumber = (value: number) => `${Number(value / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;

const startOfWeekMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfMonth = (d: Date) => {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

type PeriodKey = "day" | "week" | "month";
type PeriodSummary = { income: number; expense: number; net: number };

const summarizePeriods = (transactions: Transaction[]): Record<PeriodKey, PeriodSummary> => {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = startOfWeekMonday(now);
  const monthStart = startOfMonth(now);

  const ranges: Record<PeriodKey, { start: Date; end: Date }> = {
    day: { start: dayStart, end: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) },
    week: { start: weekStart, end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
    month: { start: monthStart, end: new Date(new Date(monthStart).setMonth(monthStart.getMonth() + 1)) },
  };

  const initial: Record<PeriodKey, PeriodSummary> = {
    day: { income: 0, expense: 0, net: 0 },
    week: { income: 0, expense: 0, net: 0 },
    month: { income: 0, expense: 0, net: 0 },
  };

  return transactions.reduce((acc, tx) => {
    const t = new Date(tx.transaction_time);
    (Object.keys(ranges) as PeriodKey[]).forEach((key) => {
      const { start, end } = ranges[key];
      if (t >= start && t < end) {
        if (tx.type === "income") {
          acc[key].income += tx.amount;
          acc[key].net += tx.amount;
        } else {
          acc[key].expense += tx.amount;
          acc[key].net -= tx.amount;
        }
      }
    });
    return acc;
  }, initial);
};

const buildCategoryTotals = (transactions: Transaction[]) => {
  const map = new Map<string, { income: number; expense: number }>();
  transactions.forEach((tx) => {
    const key = tx.category?.name ?? "Uncategorized";
    const current = map.get(key) ?? { income: 0, expense: 0 };
    if (tx.type === "income") {
      current.income += tx.amount;
    } else {
      current.expense += tx.amount;
    }
    map.set(key, current);
  });
  return Array.from(map.entries()).map(([name, totals]) => ({
    name,
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
  }));
};

const buildDailySeries = (transactions: Transaction[], days = 7) => {
  const now = new Date();
  const labels: string[] = [];
  const buckets = new Map<string, { income: number; expense: number }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-CA");
    labels.push(label);
    buckets.set(label, { income: 0, expense: 0 });
  }

  transactions.forEach((tx) => {
    const d = new Date(tx.transaction_time);
    d.setHours(0, 0, 0, 0);
    const label = d.toLocaleDateString("en-CA");
    if (!buckets.has(label)) return;
    const entry = buckets.get(label)!;
    if (tx.type === "income") {
      buckets.set(label, { ...entry, income: entry.income + tx.amount });
    } else {
      buckets.set(label, { ...entry, expense: entry.expense + tx.amount });
    }
  });

  return labels.map((label) => {
    const entry = buckets.get(label) ?? { income: 0, expense: 0 };
    return { label, income: entry.income, expense: entry.expense, net: entry.income - entry.expense };
  });
};

export function CashflowReport({ transactions, range }: { transactions: Transaction[]; range: string }) {
  const { data: queryTransactions = transactions } = useCashflowTransactions(range, transactions);
  const resolvedTransactions = queryTransactions ?? [];
  const summaries = summarizePeriods(resolvedTransactions);
  const categoryTotals = buildCategoryTotals(resolvedTransactions).sort((a, b) => b.net - a.net);

  const chartRef = useRef<HTMLDivElement | null>(null);
  const [dayCount, setDayCount] = useState(7);

  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const MIN_COL_WIDTH = 28; // approximate room for one bar + gap + label
    const MAX_DAYS = 20;

    const compute = (width: number) => {
      const cols = Math.max(1, Math.min(MAX_DAYS, Math.floor(width / MIN_COL_WIDTH)));
      setDayCount((prev) => (prev === cols ? prev : cols));
    };

    // initial run
    compute(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry?.contentRect?.width) return;
      compute(entry.contentRect.width);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dailySeries = useMemo(() => buildDailySeries(resolvedTransactions, dayCount), [resolvedTransactions, dayCount]);
  const maxDailyValue = useMemo(() => {
    const all = dailySeries.flatMap((d) => [d.income, d.expense]);
    return Math.max(...all, 1);
  }, [dailySeries]);

  const periodMeta: Record<PeriodKey, { label: string; description: string }> = {
    day: { label: "Hôm nay", description: "Từ 00:00 đến hiện tại" },
    week: { label: "Tuần này", description: "Tính từ thứ 2" },
    month: { label: "Tháng này", description: "Tính từ ngày 1" },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(Object.keys(summaries) as PeriodKey[]).map((key) => {
          const item = summaries[key];
          return (
            <div
              key={key}
              className="flex min-h-[140px] flex-col justify-between rounded-lg border bg-white/90 p-2.5 shadow-sm ring-1 ring-black/5 sm:min-h-[150px] sm:rounded-xl sm:p-3"
            >
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 sm:text-[11px]">
                  {periodMeta[key].label}
                </p>
                <p className="text-[10px] text-muted-foreground sm:text-[11px]">{periodMeta[key].description}</p>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5 sm:mt-2 sm:gap-2">
                <span className={`text-lg font-semibold sm:text-2xl ${item.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {item.net >= 0 ? "+" : ""}
                  {formatNumber(item.net)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-col gap-1 text-[9px] sm:mt-2 sm:gap-2 sm:text-[10px]">
                <div className="inline-flex w-fit self-end items-center justify-between rounded-full bg-emerald-50 px-2 py-1 sm:px-2.5">
                  <span className="text-[9px] uppercase tracking-wide text-emerald-700 sm:text-[10px]">Thu</span>
                  <span className="font-semibold text-emerald-700 leading-tight">+{formatNumber(item.income)}</span>
                </div>
                <div className="inline-flex w-fit self-end items-center justify-between rounded-full bg-red-50 px-2 py-1 sm:px-2.5">
                  <span className="text-[9px] uppercase tracking-wide text-red-700 sm:text-[10px]">Chi</span>
                  <span className="font-semibold text-red-700 leading-tight">-{formatNumber(item.expense)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Xu hướng {dayCount} ngày</p>
            <p className="text-xs text-muted-foreground">Thu/chi cùng một line, tự co giãn theo chiều rộng (tối đa 20 ngày)</p>
          </div>
          <span className="text-xs text-muted-foreground">Đỉnh: {formatNumber(maxDailyValue)}</span>
        </div>
        <div className="mt-4" ref={chartRef}>
          <div className="space-y-2">
            <div className="relative h-44 w-full overflow-hidden">
              <TrendLines series={dailySeries} maxValue={maxDailyValue} />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(24px,1fr))] gap-1 text-[10px] text-muted-foreground">
              {dailySeries.map((d) => (
                <span key={d.label} className="text-center">
                  {d.label.slice(5)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendLines({ series, maxValue }: { series: ReturnType<typeof buildDailySeries>; maxValue: number }) {
  if (!series.length) return null;
  const height = 140;
  const width = Math.max(80, series.length * 30);
  const step = series.length === 1 ? width : width / (series.length - 1);
  const scaleY = (value: number) => height - (value / maxValue) * height;

  const toPoints = (selector: (d: (typeof series)[number]) => number) =>
    series.map((d, idx) => `${idx * step},${scaleY(selector(d))}`).join(" ");

  const incomePoints = toPoints((d) => d.income);
  const expensePoints = toPoints((d) => d.expense);

  return (
    <svg viewBox={`0 0 ${width} ${height + 16}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(16, 185, 129, 0.35)" />
          <stop offset="100%" stopColor="rgba(16, 185, 129, 0.05)" />
        </linearGradient>
        <linearGradient id="expenseFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(239, 68, 68, 0.3)" />
          <stop offset="100%" stopColor="rgba(239, 68, 68, 0.05)" />
        </linearGradient>
      </defs>
      <polyline
        points={incomePoints}
        fill="none"
        stroke="rgba(16, 185, 129, 0.9)"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={expensePoints}
        fill="none"
        stroke="rgba(239, 68, 68, 0.9)"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={`${incomePoints} ${expensePoints.split(" ").reverse().join(" ")}`}
        fill="url(#incomeFill)"
        stroke="none"
        opacity={0.25}
      />
      <polyline
        points={`${expensePoints} ${incomePoints.split(" ").reverse().join(" ")}`}
        fill="url(#expenseFill)"
        stroke="none"
        opacity={0.2}
      />
      {series.map((d, idx) => (
        <g key={d.label}>
          <circle cx={idx * step} cy={scaleY(d.income)} r={3} fill="rgba(16,185,129,0.95)" />
          <circle cx={idx * step} cy={scaleY(d.expense)} r={3} fill="rgba(239,68,68,0.95)" />
        </g>
      ))}
    </svg>
  );
}
