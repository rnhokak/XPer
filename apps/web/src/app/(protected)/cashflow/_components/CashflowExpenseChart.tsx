"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type CashflowTransaction } from "@/hooks/useCashflowTransactions";

const CHART_HEIGHT = 168;

const getDayCountForWidth = (width: number) => {
  if (width < 640) return 6;
  if (width < 900) return 9;
  if (width < 1200) return 12;
  return 18;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)));

function useResponsiveDayCount() {
  const fallback = 12;
  const getInitial = () => (typeof window === "undefined" ? fallback : getDayCountForWidth(window.innerWidth));
  const [count, setCount] = useState(getInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setCount(getDayCountForWidth(window.innerWidth));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return count;
}

type DaySlot = { label: string; current: number; previous: number };

export function CashflowExpenseChart({ transactions }: { transactions: CashflowTransaction[] }) {
  const gradientId = useId();
  const dayCount = useResponsiveDayCount();

  const { daySlots, totalCurrent, totalPrevious } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (dayCount - 1));

    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - dayCount);

    const clampDay = (date: Date) => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    };

    const currentTotals = new Map<string, number>();
    const previousTotals = new Map<string, number>();

    transactions.forEach((tx) => {
      if (tx.type !== "expense") return;
      const txDay = clampDay(new Date(tx.transaction_time));
      const key = txDay.toISOString().slice(0, 10);

      if (txDay >= startDate && txDay <= today) {
        currentTotals.set(key, (currentTotals.get(key) ?? 0) + tx.amount);
      }

      if (txDay >= prevStartDate && txDay < startDate) {
        previousTotals.set(key, (previousTotals.get(key) ?? 0) + tx.amount);
      }
    });

    const slots: DaySlot[] = Array.from({ length: dayCount }, (_, idx) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + idx);
      const key = date.toISOString().slice(0, 10);
      const prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - dayCount);
      const prevKey = prevDate.toISOString().slice(0, 10);
      return {
        label: date.toLocaleDateString("vi-VN", { day: "2-digit" }),
        current: currentTotals.get(key) ?? 0,
        previous: previousTotals.get(prevKey) ?? 0,
      };
    });

    const currentTotal = slots.reduce((sum, slot) => sum + slot.current, 0);
    const previousTotal = slots.reduce((sum, slot) => sum + slot.previous, 0);

    return { daySlots: slots, totalCurrent: currentTotal, totalPrevious: previousTotal };
  }, [transactions, dayCount]);

  const maxValue = Math.max(
    ...daySlots.map((slot) => Math.max(slot.current, slot.previous)),
    1
  );

  const viewWidth = Math.max(dayCount, 1);
  const step = dayCount > 0 ? viewWidth / dayCount : 1;
  const barWidth = Math.max(step * 0.8, 0.4);
  const barGradientId = `expense-bar-${gradientId}`;
  const lineGradientId = `expense-line-${gradientId}`;

  const prevLinePoints = daySlots
    .map((slot, idx) => {
      const x = idx * step + step / 2;
      const normalized = slot.previous / maxValue;
      const y = CHART_HEIGHT - normalized * CHART_HEIGHT;
      return `${x},${y}`;
    })
    .join(" ");

  const diff = totalCurrent - totalPrevious;
  const isPositive = diff >= 0;
  const diffLabel = `${isPositive ? "+" : "-"}${formatCurrency(Math.abs(diff))} đ so với kỳ trước`;

  const firstLabel = daySlots[0]?.label ?? "";
  const midLabel = daySlots[Math.floor((daySlots.length - 1) / 2)]?.label ?? "";
  const lastLabel = daySlots[daySlots.length - 1]?.label ?? "";

  return (
    <Card className="rounded-3xl border border-slate-100 bg-gradient-to-br from-white via-slate-50 to-blue-50/30 shadow-lg">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BarChart3 className="h-4 w-4" />
          Chi tiêu theo ngày
        </CardTitle>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          <p className="text-base font-bold text-slate-900">{formatCurrency(totalCurrent)} đ</p>
          Chu kỳ hiện tại
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-inner">
            <svg
              role="img"
              className="overflow-visible"
            
              height={CHART_HEIGHT + 24}
            >
              <defs>
                <linearGradient id={barGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fb7185" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.6" />
                </linearGradient>
                <linearGradient id={lineGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
              </defs>
              <line
                x1={0}
                x2={viewWidth}
                y1={CHART_HEIGHT - 0.5}
                y2={CHART_HEIGHT - 0.5}
                stroke="rgba(15,23,42,0.08)"
                strokeWidth="1"
              />
              {daySlots.map((slot, idx) => {
                const x = idx * step + (step - barWidth) / 2;
                const height = (slot.current / maxValue) * CHART_HEIGHT;
                const barHeight = Math.max(height, 1);
                const y = CHART_HEIGHT - barHeight;
                return (
                  <rect
                    key={`bar-${slot.label}-${idx}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={3}
                    fill={`url(#${barGradientId})`}
                  />
                );
              })}
              {daySlots.map((slot, idx) => {
                const x = idx * step + step / 2;
                return (
                  <text
                    key={`label-${slot.label}-${idx}`}
                    x={x}
                    y={CHART_HEIGHT + 10}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#475569"
                  >
                    {slot.label}
                  </text>
                );
              })}
              {daySlots.length > 0 && (
                <polyline
                  fill="none"
                  stroke={`url(#${lineGradientId})`}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                  points={prevLinePoints}
                />
              )}
            </svg>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span className="flex items-center gap-2 text-rose-600">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Chu kỳ hiện tại · {formatCurrency(totalCurrent)} đ
            </span>
            <span className="flex items-center gap-2 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Chu kỳ trước · {formatCurrency(totalPrevious)} đ
            </span>
            <span className={`ml-auto text-[11px] font-bold ${isPositive ? "text-rose-600" : "text-emerald-600"}`}>
              {diffLabel}
            </span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span>{firstLabel}</span>
            <span>{midLabel}</span>
            <span>{lastLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
