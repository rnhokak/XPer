import { useId, useMemo, useState } from "react";
import { type CashflowTransaction } from "@/hooks/useCashflowTransactions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Calendar, GitCompare, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 175;
const CHART_PADDING_TOP = 22;
const CHART_PADDING_BOTTOM = 30;
const CHART_PADDING_X = 24;

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(val)));

const formatCurrencyShort = (val: number) => {
  if (val >= 1000000000) return `${(val / 1000000000).toFixed(1)}B`;
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
  return String(Math.round(val));
};

export type CashflowDayPoint = {
  date: Date;
  dateKey: string;
  label: string;
  shortWeekday: string;
  income: number;
  expense: number;
  dailyNet: number;
  cumulativeNet: number;
  cumulativeIncome: number;
  cumulativeExpense: number;
  count: number;
};

type Props = {
  transactions: CashflowTransaction[];
  isLoading?: boolean;
};

type ChartMode = "split" | "expense" | "income" | "net" | "daily";

const buildSmoothPath = (coords: Array<{ x: number; y: number }>, baselineY: number) => {
  if (!coords.length) return { line: "", area: "" };

  let line = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? 0 : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 >= coords.length ? i + 1 : i + 2];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    line += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const firstX = coords[0].x;
  const lastX = coords[coords.length - 1].x;
  const area = `${line} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  return { line, area };
};

export function CashflowCumulativeChart({ transactions, isLoading = false }: Props) {
  const gradientId = useId();
  // Default to "split" mode as requested: separate income and expense cumulative curves!
  const [activeMode, setActiveMode] = useState<ChartMode>("split");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Calculate 30-day chronological dataset
  const {
    points,
    total30dIncome,
    total30dExpense,
    total30dNet,
    savingsRate,
    maxCumulativeAbsolute,
    maxCumulativeNet,
    minCumulativeNet,
    maxDaily,
  } = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);

    const clampDay = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const dateKey = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    const dailyMap = new Map<string, { income: number; expense: number; count: number }>();

    transactions.forEach((tx) => {
      const txDate = clampDay(new Date(tx.transaction_time));
      if (txDate >= startDate && txDate <= now) {
        const key = dateKey(txDate);
        const current = dailyMap.get(key) ?? { income: 0, expense: 0, count: 0 };
        if (tx.type === "income") current.income += Math.abs(tx.amount);
        if (tx.type === "expense") current.expense += Math.abs(tx.amount);
        current.count += 1;
        dailyMap.set(key, current);
      }
    });

    let runNet = 0;
    let runIncome = 0;
    let runExpense = 0;

    const pts: CashflowDayPoint[] = [];

    for (let i = 0; i < 30; i++) {
      const curDate = new Date(startDate);
      curDate.setDate(curDate.getDate() + i);
      const key = dateKey(curDate);
      const dayData = dailyMap.get(key) ?? { income: 0, expense: 0, count: 0 };

      const dailyNet = dayData.income - dayData.expense;
      runNet += dailyNet;
      runIncome += dayData.income;
      runExpense += dayData.expense;

      pts.push({
        date: curDate,
        dateKey: key,
        label: curDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
        shortWeekday: curDate.toLocaleDateString("vi-VN", { weekday: "short" }),
        income: dayData.income,
        expense: dayData.expense,
        dailyNet,
        cumulativeNet: runNet,
        cumulativeIncome: runIncome,
        cumulativeExpense: runExpense,
        count: dayData.count,
      });
    }

    const netVals = pts.map((p) => p.cumulativeNet);
    const dVals = pts.map((p) => Math.max(p.income, p.expense));

    const maxAbs = Math.max(runIncome, runExpense, 1000);
    const maxNet = Math.max(...netVals, 1000);
    const minNet = Math.min(...netVals, 0);
    const maxD = Math.max(...dVals, 1000);

    const rate = runIncome > 0 ? (runNet / runIncome) * 100 : 0;

    return {
      points: pts,
      total30dIncome: runIncome,
      total30dExpense: runExpense,
      total30dNet: runNet,
      savingsRate: rate,
      maxCumulativeAbsolute: maxAbs,
      maxCumulativeNet: maxNet,
      minCumulativeNet: minNet,
      maxDaily: maxD,
    };
  }, [transactions]);

  // Coordinate scales for responsive SVG
  const svgWidth = 800;
  const svgHeight = CHART_HEIGHT + CHART_PADDING_TOP + CHART_PADDING_BOTTOM;
  const plotWidth = svgWidth - CHART_PADDING_X * 2;
  const plotHeight = CHART_HEIGHT;

  const stepX = plotWidth / (points.length - 1 || 1);
  const bottomY = CHART_PADDING_TOP + plotHeight;

  // Y-Scale for Separated Cumulative Curves (0 to maxCumulativeAbsolute)
  const getYForCumulativeSplit = (val: number) => {
    const norm = Math.max(0, val) / (maxCumulativeAbsolute || 1);
    return CHART_PADDING_TOP + plotHeight - norm * plotHeight;
  };

  // Y-Scale for Cumulative Net (minCumulativeNet to maxCumulativeNet)
  const netRange = maxCumulativeNet - minCumulativeNet || 1;
  const getYForCumulativeNet = (val: number) => {
    const norm = (val - minCumulativeNet) / netRange;
    return CHART_PADDING_TOP + plotHeight - norm * plotHeight;
  };

  // Zero-line Y coordinate for net mode
  const yZeroNet = getYForCumulativeNet(0);

  // Y-Scale for Daily Bars
  const getYForDaily = (val: number) => {
    const norm = val / (maxDaily || 1);
    return norm * (plotHeight * 0.75);
  };

  // Build SVG Paths for Separate Income & Expense Cumulative Curves
  const incomeCoords = useMemo(() => {
    return points.map((p, idx) => ({
      x: CHART_PADDING_X + idx * stepX,
      y: getYForCumulativeSplit(p.cumulativeIncome),
    }));
  }, [points, stepX, maxCumulativeAbsolute]);

  const expenseCoords = useMemo(() => {
    return points.map((p, idx) => ({
      x: CHART_PADDING_X + idx * stepX,
      y: getYForCumulativeSplit(p.cumulativeExpense),
    }));
  }, [points, stepX, maxCumulativeAbsolute]);

  const netCoords = useMemo(() => {
    return points.map((p, idx) => ({
      x: CHART_PADDING_X + idx * stepX,
      y: getYForCumulativeNet(p.cumulativeNet),
    }));
  }, [points, stepX, minCumulativeNet, netRange]);

  const incomePath = useMemo(() => buildSmoothPath(incomeCoords, bottomY), [incomeCoords, bottomY]);
  const expensePath = useMemo(() => buildSmoothPath(expenseCoords, bottomY), [expenseCoords, bottomY]);
  const netPath = useMemo(() => {
    const baselineY = Math.min(Math.max(yZeroNet, CHART_PADDING_TOP), bottomY);
    return buildSmoothPath(netCoords, baselineY);
  }, [netCoords, yZeroNet, bottomY]);

  const activePoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : points[points.length - 1];
  const isNetPositive = total30dNet >= 0;

  if (isLoading) {
    return (
      <Card className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-52 w-full animate-pulse rounded-2xl bg-slate-100" />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header with Title and Mode Switcher */}
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <GitCompare className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 sm:text-lg flex items-center gap-2">
                  <span>Lũy kế dòng tiền 30 ngày</span>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Tách riêng Thu & Chi
                  </span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  So sánh trực quan xu hướng tích lũy thu nhập và chi tiêu theo từng ngày
                </CardDescription>
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center self-start rounded-xl bg-slate-200/70 p-1 sm:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveMode("split")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95 whitespace-nowrap",
                activeMode === "split"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Thu & Chi riêng biệt
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("expense")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95 whitespace-nowrap",
                activeMode === "expense"
                  ? "bg-white text-rose-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Lũy kế Chi
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("income")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95 whitespace-nowrap",
                activeMode === "income"
                  ? "bg-white text-emerald-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Lũy kế Thu
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("net")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95 whitespace-nowrap",
                activeMode === "net"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Lũy kế Ròng
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("daily")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95 whitespace-nowrap",
                activeMode === "daily"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Cột ngày
            </button>
          </div>
        </div>

        {/* 30-Day Metrics Bar: Clearly separating Income and Expense */}
        <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4 sm:gap-3">
          {/* Lũy kế Thu 30 ngày */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Lũy kế Thu 30 ngày
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="money-blur text-lg font-black text-emerald-700 sm:text-xl">
                +{formatCurrency(total30dIncome)} đ
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-emerald-600/80 font-medium">
              TB {formatCurrency(Math.round(total30dIncome / 30))} đ/ngày
            </div>
          </div>

          {/* Lũy kế Chi 30 ngày */}
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                Lũy kế Chi 30 ngày
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-100 text-rose-700">
                <ArrowDownRight className="h-3 w-3" />
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="money-blur text-lg font-black text-rose-700 sm:text-xl">
                -{formatCurrency(total30dExpense)} đ
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-rose-600/80 font-medium">
              TB {formatCurrency(Math.round(total30dExpense / 30))} đ/ngày
            </div>
          </div>

          {/* Lũy kế ròng (Chênh lệch Thu - Chi) */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Chênh lệch Thu - Chi
              </span>
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md",
                  isNetPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}
              >
                {isNetPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={cn(
                  "money-blur text-lg font-bold sm:text-xl",
                  isNetPositive ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {isNetPositive ? "+" : ""}
                {formatCurrency(total30dNet)} đ
              </span>
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-slate-500">
              {isNetPositive ? "Thặng dư tài chính" : "Thâm hụt tài chính"}
            </div>
          </div>

          {/* Tỷ lệ tiết kiệm / Giữ lại */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Tỷ lệ giữ lại
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={cn(
                  "text-lg font-bold sm:text-xl",
                  savingsRate >= 20 ? "text-emerald-600" : savingsRate > 0 ? "text-amber-600" : "text-rose-600"
                )}
              >
                {savingsRate.toFixed(1)}%
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Ròng / Tổng thu</div>
          </div>
        </div>
      </CardHeader>

      {/* Interactive Chart Canvas */}
      <CardContent className="p-4 sm:p-5">
        {/* Dynamic Hover Detail Card */}
        {activePoint && (
          <div className="mb-3 flex flex-wrap items-center justify-between rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3.5 py-2 text-xs backdrop-blur shadow-2xs">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-semibold text-slate-800">
                {activePoint.shortWeekday}, {activePoint.label}
              </span>
              {hoveredIdx === null ? (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  Hôm nay
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 font-medium">
              <div>
                <span className="text-emerald-600 font-semibold">Lũy kế Thu: </span>
                <span className="money-blur font-bold text-emerald-700">
                  +{formatCurrency(activePoint.cumulativeIncome)} đ
                </span>
              </div>
              <div className="text-slate-300">|</div>
              <div>
                <span className="text-rose-600 font-semibold">Lũy kế Chi: </span>
                <span className="money-blur font-bold text-rose-700">
                  -{formatCurrency(activePoint.cumulativeExpense)} đ
                </span>
              </div>
              <div className="text-slate-300 hidden sm:inline">|</div>
              <div className="hidden sm:inline-block">
                <span className="text-slate-500">Chênh lệch: </span>
                <span
                  className={cn(
                    "money-blur font-bold",
                    activePoint.cumulativeNet >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {activePoint.cumulativeNet >= 0 ? "+" : ""}
                  {formatCurrency(activePoint.cumulativeNet)} đ
                </span>
              </div>
              <div className="text-slate-300 hidden md:inline">|</div>
              <div className="hidden md:inline-block text-[11px] text-slate-400">
                Ngày này: +{formatCurrency(activePoint.income)} / -{formatCurrency(activePoint.expense)}
              </div>
            </div>
          </div>
        )}

        {/* SVG Graph */}
        <div className="relative select-none">
          <svg
            className="w-full overflow-visible touch-pan-y"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            style={{ height: `${svgHeight}px` }}
            onMouseLeave={() => setHoveredIdx(null)}
            onTouchEnd={() => setHoveredIdx(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
              const idx = Math.round((relX - CHART_PADDING_X) / stepX);
              const clamped = Math.max(0, Math.min(points.length - 1, idx));
              setHoveredIdx(clamped);
            }}
            onTouchMove={(e) => {
              if (!e.touches[0]) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((e.touches[0].clientX - rect.left) / rect.width) * svgWidth;
              const idx = Math.round((relX - CHART_PADDING_X) / stepX);
              const clamped = Math.max(0, Math.min(points.length - 1, idx));
              setHoveredIdx(clamped);
            }}
          >
            <defs>
              {/* Gradient for Cumulative Income Area */}
              <linearGradient id={`cumul-inc-grad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>

              {/* Gradient for Cumulative Expense Area */}
              <linearGradient id={`cumul-exp-grad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
              </linearGradient>

              {/* Gradient for Cumulative Net Area */}
              <linearGradient id={`cumul-net-grad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isNetPositive ? "#10b981" : "#f43f5e"} stopOpacity="0.25" />
                <stop offset="100%" stopColor={isNetPositive ? "#10b981" : "#f43f5e"} stopOpacity="0.0" />
              </linearGradient>

              {/* Bar Gradients */}
              <linearGradient id={`bar-inc-grad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.65" />
              </linearGradient>
              <linearGradient id={`bar-exp-grad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#e11d48" stopOpacity="0.65" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines for Separated (Split / Income / Expense) views */}
            {activeMode !== "net" && (
              <>
                {/* 100% Top Gridline */}
                <line
                  x1={CHART_PADDING_X}
                  x2={svgWidth - CHART_PADDING_X}
                  y1={CHART_PADDING_TOP}
                  y2={CHART_PADDING_TOP}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={svgWidth - CHART_PADDING_X}
                  y={CHART_PADDING_TOP - 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="600"
                >
                  {formatCurrencyShort(maxCumulativeAbsolute)} đ
                </text>

                {/* 50% Mid Gridline */}
                <line
                  x1={CHART_PADDING_X}
                  x2={svgWidth - CHART_PADDING_X}
                  y1={CHART_PADDING_TOP + plotHeight / 2}
                  y2={CHART_PADDING_TOP + plotHeight / 2}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={svgWidth - CHART_PADDING_X}
                  y={CHART_PADDING_TOP + plotHeight / 2 - 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="500"
                >
                  {formatCurrencyShort(maxCumulativeAbsolute / 2)} đ
                </text>

                {/* Baseline 0 */}
                <line
                  x1={CHART_PADDING_X}
                  x2={svgWidth - CHART_PADDING_X}
                  y1={bottomY}
                  y2={bottomY}
                  stroke="#cbd5e1"
                  strokeWidth="1.2"
                />
                <text
                  x={CHART_PADDING_X}
                  y={bottomY - 4}
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="600"
                >
                  0 đ
                </text>
              </>
            )}

            {/* Zero Baseline for Net Mode */}
            {activeMode === "net" && (
              <>
                <line
                  x1={CHART_PADDING_X}
                  x2={svgWidth - CHART_PADDING_X}
                  y1={yZeroNet}
                  y2={yZeroNet}
                  stroke="#cbd5e1"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <text
                  x={CHART_PADDING_X}
                  y={yZeroNet - 4}
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="600"
                >
                  Mốc 0 đ
                </text>
              </>
            )}

            {/* MODE 1: DAILY BARS */}
            {activeMode === "daily" &&
              points.map((p, idx) => {
                const cx = CHART_PADDING_X + idx * stepX;
                const barW = Math.max(stepX * 0.38, 4);

                const incH = getYForDaily(p.income);
                const expH = getYForDaily(p.expense);

                return (
                  <g key={`daily-bar-${p.dateKey}`}>
                    {/* Income Bar */}
                    {p.income > 0 && (
                      <rect
                        x={cx - barW - 1}
                        y={bottomY - incH}
                        width={barW}
                        height={incH}
                        rx={2}
                        fill={`url(#bar-inc-grad-${gradientId})`}
                      />
                    )}
                    {/* Expense Bar */}
                    {p.expense > 0 && (
                      <rect
                        x={cx + 1}
                        y={bottomY - expH}
                        width={barW}
                        height={expH}
                        rx={2}
                        fill={`url(#bar-exp-grad-${gradientId})`}
                      />
                    )}
                  </g>
                );
              })}

            {/* MODE 2: SPLIT VIEW (SEPARATE INCOME & EXPENSE CUMULATIVE CURVES) */}
            {(activeMode === "split" || activeMode === "income") && (
              <>
                {/* Cumulative Income Area */}
                <path d={incomePath.area} fill={`url(#cumul-inc-grad-${gradientId})`} />
                {/* Cumulative Income Line */}
                <path
                  d={incomePath.line}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Income point dots */}
                {incomeCoords.map((pt, idx) => {
                  const isHovered = hoveredIdx === idx;
                  const isLast = idx === incomeCoords.length - 1;
                  if (!isHovered && !isLast && idx % 5 !== 0) return null;

                  return (
                    <circle
                      key={`inc-pt-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : isLast ? 4.5 : 3}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      className="transition-all duration-150"
                    />
                  );
                })}
              </>
            )}

            {(activeMode === "split" || activeMode === "expense") && (
              <>
                {/* Cumulative Expense Area */}
                <path d={expensePath.area} fill={`url(#cumul-exp-grad-${gradientId})`} />
                {/* Cumulative Expense Line */}
                <path
                  d={expensePath.line}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Expense point dots */}
                {expenseCoords.map((pt, idx) => {
                  const isHovered = hoveredIdx === idx;
                  const isLast = idx === expenseCoords.length - 1;
                  if (!isHovered && !isLast && idx % 5 !== 0) return null;

                  return (
                    <circle
                      key={`exp-pt-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : isLast ? 4.5 : 3}
                      fill="#f43f5e"
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      className="transition-all duration-150"
                    />
                  );
                })}
              </>
            )}

            {/* MODE 3: CUMULATIVE NET VIEW */}
            {activeMode === "net" && (
              <>
                <path d={netPath.area} fill={`url(#cumul-net-grad-${gradientId})`} />
                <path
                  d={netPath.line}
                  fill="none"
                  stroke={isNetPositive ? "#059669" : "#e11d48"}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {netCoords.map((pt, idx) => {
                  const isHovered = hoveredIdx === idx;
                  const isLast = idx === netCoords.length - 1;
                  if (!isHovered && !isLast && idx % 5 !== 0) return null;

                  return (
                    <circle
                      key={`net-pt-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : isLast ? 4.5 : 3}
                      fill={isNetPositive ? "#059669" : "#e11d48"}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      className="transition-all duration-150"
                    />
                  );
                })}
              </>
            )}

            {/* Hover Vertical Guide Line */}
            {hoveredIdx !== null && (
              <line
                x1={CHART_PADDING_X + hoveredIdx * stepX}
                x2={CHART_PADDING_X + hoveredIdx * stepX}
                y1={CHART_PADDING_TOP}
                y2={bottomY}
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            )}

            {/* X-Axis Date Labels */}
            {points.map((p, idx) => {
              // Show label every 5 days + last day
              if (idx % 5 !== 0 && idx !== points.length - 1) return null;
              const x = CHART_PADDING_X + idx * stepX;
              return (
                <text
                  key={`xlabel-${p.dateKey}`}
                  x={x}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="500"
                  fill="#64748b"
                >
                  {p.label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            {(activeMode === "split" || activeMode === "income") && (
              <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-2xs" />
                Lũy kế Thu nhập
              </span>
            )}
            {(activeMode === "split" || activeMode === "expense") && (
              <span className="flex items-center gap-1.5 font-semibold text-rose-700">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-2xs" />
                Lũy kế Chi tiêu
              </span>
            )}
            {activeMode === "net" && (
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    isNetPositive ? "bg-emerald-600" : "bg-rose-600"
                  )}
                />
                Lũy kế ròng (Thu - Chi)
              </span>
            )}
            {activeMode === "daily" && (
              <>
                <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  Thu ngày
                </span>
                <span className="flex items-center gap-1.5 font-medium text-rose-700">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                  Chi ngày
                </span>
              </>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">
            Chạm / rê chuột vào biểu đồ để xem chi tiết từng ngày
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
