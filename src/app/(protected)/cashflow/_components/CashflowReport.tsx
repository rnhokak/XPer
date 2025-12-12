"use client";

import { useMemo } from "react";
import { useCashflowTransactions, type CashflowTransaction } from "@/hooks/useCashflowTransactions";
import { TrendingDown, TrendingUp, Minus, Calendar, CalendarDays, CalendarRange } from "lucide-react";

type Transaction = CashflowTransaction;

const formatNumber = (value: number) => {
  if (value === 0) return "0";
  return `${Number(value / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;
};

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



const previousDayStart = (d: Date) => {
  const date = new Date(d);
  date.setDate(date.getDate() - 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const previousWeekStart = (d: Date) => {
  const date = new Date(d);
  date.setDate(date.getDate() - 7);
  return startOfWeekMonday(date);
};

const previousMonthStart = (d: Date) => {
  const date = new Date(d);
  date.setMonth(date.getMonth() - 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

type PeriodKey = "day" | "week" | "month";
type PeriodSummaryWithPrevious = { expense: number; previousExpense: number }; // Track expenses and previous period expenses

const summarizePeriodsWithComparison = (transactions: Transaction[]): Record<PeriodKey, PeriodSummaryWithPrevious> => {
  const now = new Date();
  
  // Current periods
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = startOfWeekMonday(now);
  const monthStart = startOfMonth(now);

  // Previous periods
  const prevDayStart = previousDayStart(now);
  const prevWeekStart = previousWeekStart(now);
  const prevMonthStart = previousMonthStart(now);

  const ranges: Record<PeriodKey, { currentStart: Date; currentEnd: Date; prevStart: Date; prevEnd: Date }> = {
    day: { 
      currentStart: dayStart, 
      currentEnd: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000),
      prevStart: prevDayStart,
      prevEnd: new Date(prevDayStart.getTime() + 24 * 60 * 60 * 1000)
    },
    week: { 
      currentStart: weekStart, 
      currentEnd: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
      prevStart: prevWeekStart,
      prevEnd: new Date(prevWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    },
    month: { 
      currentStart: monthStart, 
      currentEnd: new Date(new Date(monthStart).setMonth(monthStart.getMonth() + 1)),
      prevStart: prevMonthStart,
      prevEnd: new Date(new Date(prevMonthStart).setMonth(prevMonthStart.getMonth() + 1))
    },
  };

  const initial: Record<PeriodKey, PeriodSummaryWithPrevious> = {
    day: { expense: 0, previousExpense: 0 },
    week: { expense: 0, previousExpense: 0 },
    month: { expense: 0, previousExpense: 0 },
  };

  return transactions.reduce((acc, tx) => {
    // Only count expenses, not income
    if (tx.type !== "expense") return acc;
    
    const t = new Date(tx.transaction_time);
    (Object.keys(ranges) as PeriodKey[]).forEach((key) => {
      const { currentStart, currentEnd, prevStart, prevEnd } = ranges[key];
      
      if (t >= currentStart && t < currentEnd) {
        acc[key].expense += tx.amount;
      }
      
      if (t >= prevStart && t < prevEnd) {
        acc[key].previousExpense += tx.amount;
      }
    });
    return acc;
  }, initial);
};

const getPeriodIcon = (key: PeriodKey) => {
  switch (key) {
    case "day": return <Calendar className="h-4 w-4" />;
    case "week": return <CalendarDays className="h-4 w-4" />;
    case "month": return <CalendarRange className="h-4 w-4" />;
    default: return <Calendar className="h-4 w-4" />;
  }
};

const getDifference = (current: number, previous: number) => {
  if (previous === 0 && current === 0) return { diff: 0, percentage: 0, trend: "stable" };
  if (previous === 0) return { diff: current, percentage: 100, trend: "increase" };
  
  const diff = current - previous;
  const percentage = ((diff / previous) * 100);
  
  if (diff > 0) return { diff, percentage, trend: "increase" };
  if (diff < 0) return { diff, percentage, trend: "decrease" };
  return { diff, percentage, trend: "stable" };
};

export function CashflowReport({ transactions, range}: { transactions: Transaction[]; range: string; }) {
  const { data: queryTransactions = transactions } = useCashflowTransactions(range, transactions);
  const resolvedTransactions = queryTransactions ?? [];
  const summaries = useMemo(() => summarizePeriodsWithComparison(resolvedTransactions), [resolvedTransactions]);

  const periodMeta: Record<PeriodKey, { label: string; icon: JSX.Element }> = {
    day: { label: "Hôm nay", icon: getPeriodIcon("day") },
    week: { label: "Tuần", icon: getPeriodIcon("week") },
    month: { label: "Tháng", icon: getPeriodIcon("month") },
  };

  return (
    <div className="space-y-4">
      <div className="grid  grid-cols-3  gap-3">
        {(Object.keys(summaries) as PeriodKey[]).map((key) => {
          const item = summaries[key];
          const { diff, percentage, trend } = getDifference(item.expense, item.previousExpense);
          
          // Special styling for the monthly report
          const isMonthly = key === 'month';
          const cardClasses = isMonthly 
            ? "rounded-xl border bg-gradient-to-br from-blue-50 to-white p-4 shadow-md ring-1 ring-blue-200 hover:shadow-lg transition-shadow" 
            : "rounded-xl border bg-white p-4 shadow-sm ring-1 ring-gray-100 hover:shadow-md transition-shadow";
          
          return (
            <div
              key={key}
              className={cardClasses}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {periodMeta[key].icon}
                  <p className={`text-sm font-semibold ${isMonthly ? 'text-blue-700' : 'text-gray-700'}`}>{periodMeta[key].label}</p>
                </div>
              </div>
              
              <div className="mt-2">
                <div className="flex items-baseline justify-between">
                  <span className={`money-blur text-xl font-bold ${isMonthly ? 'text-blue-600' : 'text-red-600'}`}>
                    { formatNumber(item.expense)}
                  </span>
                </div>
                
                {item.previousExpense > 0 && (
                  <div className={`flex  text-xs ${trend === 'increase' ? 'text-red-600' : trend === 'decrease' ? 'text-green-600' : 'text-gray-500'} mt-1 justify-end justify-between flex-col items-end`}>
                    <div className="flex ">
                      {trend === 'increase' ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                       trend === 'decrease' ? <TrendingDown className="h-3 w-3 mr-1" /> : 
                       <Minus className="h-3 w-3 mr-1" />}
                      {Math.abs(percentage).toFixed(0)}%
                    </div>
                    <div className={`text-xs ${isMonthly ? 'text-blue-500' : 'text-gray-500'} sm:mt-1`}>
                      {trend === 'increase' ? 'Tăng' : trend === 'decrease' ? 'Giảm' : 'Không đổi'} {formatNumber(diff)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
