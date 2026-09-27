import { useId, useMemo, useState } from "react";
import { type CashflowTransaction } from "@/hooks/useCashflowTransactions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 160;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 30;
const CHART_PADDING_X = 20;

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(val));

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

export function CashflowCumulativeChart({ transactions, isLoading = false }: Props) {
  const gradientId = useId();
  const [activeMode, setActiveMode] = useState<"cumulative" | "daily" | "both">("cumulative");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Calculate 30-day chronological dataset
  const { points, total30dIncome, total30dExpense, total30dNet, savingsRate, maxCumulative, minCumulative, maxDaily } =
    useMemo(() => {
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
          if (tx.type === "income") current.income += tx.amount;
          if (tx.type === "expense") current.expense += tx.amount;
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

      const cVals = pts.map((p) => p.cumulativeNet);
      const dVals = pts.map((p) => Math.max(p.income, p.expense));

      const maxC = Math.max(...cVals, 1000);
      const minC = Math.min(...cVals, 0);
      const maxD = Math.max(...dVals, 1000);

      const rate = runIncome > 0 ? (runNet / runIncome) * 100 : 0;

      return {
        points: pts,
        total30dIncome: runIncome,
        total30dExpense: runExpense,
        total30dNet: runNet,
        savingsRate: rate,
        maxCumulative: maxC,
        minCumulative: minC,
        maxDaily: maxD,
      };
    }, [transactions]);

  // Coordinate scales for responsive SVG
  const svgWidth = 800;
  const svgHeight = CHART_HEIGHT + CHART_PADDING_TOP + CHART_PADDING_BOTTOM;
  const plotWidth = svgWidth - CHART_PADDING_X * 2;
  const plotHeight = CHART_HEIGHT;

  const stepX = plotWidth / (points.length - 1 || 1);

  // Y-Scale for Cumulative Net
  const cRange = maxCumulative - minCumulative || 1;
  const getYForCumulative = (val: number) => {
    const norm = (val - minCumulative) / cRange;
    return CHART_PADDING_TOP + plotHeight - norm * plotHeight;
  };

  // Zero-line Y coordinate
  const yZero = getYForCumulative(0);

  // Y-Scale for Daily Bars
  const getYForDaily = (val: number) => {
    const norm = val / (maxDaily || 1);
    return norm * (plotHeight * 0.75);
  };

  // Build SVG Path for Cumulative Curve (using Catmull-Rom or cubic Bezier)
  const cumulativeCoords = useMemo(() => {
    return points.map((p, idx) => ({
      x: CHART_PADDING_X + idx * stepX,
      y: getYForCumulative(p.cumulativeNet),
    }));
  }, [points, stepX, minCumulative, cRange]);

  const { pathLine, pathArea } = useMemo(() => {
    if (!cumulativeCoords.length) return { pathLine: "", pathArea: "" };

    let line = `M ${cumulativeCoords[0].x} ${cumulativeCoords[0].y}`;
    for (let i = 0; i < cumulativeCoords.length - 1; i++) {
      const p0 = cumulativeCoords[i === 0 ? 0 : i - 1];
      const p1 = cumulativeCoords[i];
      const p2 = cumulativeCoords[i + 1];
      const p3 = cumulativeCoords[i + 2 >= cumulativeCoords.length ? i + 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      line += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    const firstX = cumulativeCoords[0].x;
    const lastX = cumulativeCoords[cumulativeCoords.length - 1].x;
    const baselineY = Math.min(Math.max(yZero, CHART_PADDING_TOP), CHART_PADDING_TOP + plotHeight);

    const area = `${line} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

    return { pathLine: line, pathArea: area };
  }, [cumulativeCoords, yZero]);

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
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 sm:text-lg">
                  Lũy kế dòng tiền 30 ngày
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Xu hướng tích lũy ròng (Thu - Chi) theo thời gian thực
                </CardDescription>
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center self-start rounded-xl bg-slate-200/70 p-1 sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveMode("cumulative")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95",
                activeMode === "cumulative" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Lũy kế ròng
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("daily")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95",
                activeMode === "daily" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Thu / Chi ngày
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("both")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95",
                activeMode === "both" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Kết hợp
            </button>
          </div>
        </div>

        {/* 30-Day Metrics Bar */}
        <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4 sm:gap-3">
          {/* Lũy kế ròng */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Lũy kế 30 ngày
            </span>
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
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-slate-500">
              {isNetPositive ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-600" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-rose-600" />
              )}
              <span>{isNetPositive ? "Thặng dư dòng tiền" : "Thâm hụt dòng tiền"}</span>
            </div>
          </div>

          {/* Tổng thu 30 ngày */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Tổng thu 30 ngày
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="money-blur text-lg font-bold text-slate-900 sm:text-xl">
                +{formatCurrency(total30dIncome)} đ
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">30 ngày qua</div>
          </div>

          {/* Tổng chi 30 ngày */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Tổng chi 30 ngày
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="money-blur text-lg font-bold text-slate-900 sm:text-xl">
                -{formatCurrency(total30dExpense)} đ
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              TB {formatCurrency(Math.round(total30dExpense / 30))} đ/ngày
            </div>
          </div>

          {/* Tỷ lệ tiết kiệm */}
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
          <div className="mb-3 flex flex-wrap items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2 text-xs backdrop-blur">
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

            <div className="flex flex-wrap items-center gap-3 font-medium">
              <div>
                <span className="text-slate-400">Lũy kế: </span>
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
              <div className="hidden sm:inline-block text-slate-300">|</div>
              <div>
                <span className="text-slate-400">Thu: </span>
                <span className="money-blur font-semibold text-emerald-600">
                  +{formatCurrency(activePoint.income)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Chi: </span>
                <span className="money-blur font-semibold text-rose-600">
                  -{formatCurrency(activePoint.expense)}
                </span>
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
              {/* Gradient for Cumulative Net Area */}
              <linearGradient id={`cumul-grad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop
                  offset="0%"
                  stopColor={isNetPositive ? "#10b981" : "#f43f5e"}
                  stopOpacity="0.25"
                />
                <stop
                  offset="100%"
                  stopColor={isNetPositive ? "#10b981" : "#f43f5e"}
                  stopOpacity="0.0"
                />
              </linearGradient>

              {/* Bar Gradients */}
              <linearGradient id={`inc-grad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id={`exp-grad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#e11d48" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {/* Zero Baseline */}
            <line
              x1={CHART_PADDING_X}
              x2={svgWidth - CHART_PADDING_X}
              y1={yZero}
              y2={yZero}
              stroke="#cbd5e1"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
            <text
              x={CHART_PADDING_X}
              y={yZero - 4}
              fontSize="10"
              fill="#94a3b8"
              fontWeight="600"
            >
              Mốc 0 đ
            </text>

            {/* Daily Bars (if activeMode is daily or both) */}
            {(activeMode === "daily" || activeMode === "both") &&
              points.map((p, idx) => {
                const cx = CHART_PADDING_X + idx * stepX;
                const barW = Math.max(stepX * 0.38, 4);

                const incH = getYForDaily(p.income);
                const expH = getYForDaily(p.expense);

                const opacity = activeMode === "both" ? 0.45 : 0.9;

                return (
                  <g key={`daily-bar-${p.dateKey}`}>
                    {/* Income Bar (upward from bottom or zero) */}
                    {p.income > 0 && (
                      <rect
                        x={cx - barW - 1}
                        y={CHART_PADDING_TOP + plotHeight - incH}
                        width={barW}
                        height={incH}
                        rx={2}
                        fill={`url(#inc-grad-${gradientId})`}
                        opacity={opacity}
                      />
                    )}
                    {/* Expense Bar */}
                    {p.expense > 0 && (
                      <rect
                        x={cx + 1}
                        y={CHART_PADDING_TOP + plotHeight - expH}
                        width={barW}
                        height={expH}
                        rx={2}
                        fill={`url(#exp-grad-${gradientId})`}
                        opacity={opacity}
                      />
                    )}
                  </g>
                );
              })}

            {/* Cumulative Net Area & Curve (if activeMode is cumulative or both) */}
            {(activeMode === "cumulative" || activeMode === "both") && (
              <>
                <path d={pathArea} fill={`url(#cumul-grad-${gradientId})`} />
                <path
                  d={pathLine}
                  fill="none"
                  stroke={isNetPositive ? "#059669" : "#e11d48"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Point Dots on Cumulative Line */}
                {cumulativeCoords.map((pt, idx) => {
                  const isHovered = hoveredIdx === idx;
                  const isLast = idx === cumulativeCoords.length - 1;
                  if (!isHovered && !isLast && idx % 5 !== 0) return null;

                  return (
                    <circle
                      key={`cumul-pt-${idx}`}
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
            {hoveredIdx !== null && cumulativeCoords[hoveredIdx] && (
              <line
                x1={cumulativeCoords[hoveredIdx].x}
                x2={cumulativeCoords[hoveredIdx].x}
                y1={CHART_PADDING_TOP}
                y2={CHART_PADDING_TOP + plotHeight}
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
            <span className="flex items-center gap-1.5 font-medium">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  isNetPositive ? "bg-emerald-600" : "bg-rose-600"
                )}
              />
              Lũy kế ròng (30 ngày)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Thu nhập ngày
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
              Chi tiêu ngày
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Chạm / rê chuột vào biểu đồ để xem chi tiết
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
