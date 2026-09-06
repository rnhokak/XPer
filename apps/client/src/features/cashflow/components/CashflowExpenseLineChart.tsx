import { useId, useMemo, useRef, useState, useCallback, useEffect } from 'react'
import {
  TrendingDown,
  Layers,
  Crosshair,
  Flame,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { type CashflowTransaction } from '@/hooks/useCashflowTransactions'
import { rangeBounds } from '@/lib/cashflow/utils'

type ViewMode = 'daily' | 'cum'

interface CashflowExpenseLineChartProps {
  transactions: CashflowTransaction[]
  shift?: number
  className?: string
}

const formatCurrency = (val: number, currency = 'VND') => {
  const isVnd = currency?.toUpperCase() === 'VND'
  const formatted = Math.round(val).toLocaleString('vi-VN')
  return `${formatted} ${isVnd ? 'đ' : currency}`
}

const triggerHaptic = () => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8)
    } catch {
      // Safely ignore
    }
  }
}

type DaySlot = {
  dayNum: number
  dateLabel: string
  fullDateLabel: string
  expense: number
  cumExpense: number
  count: number
  isFuture: boolean
  isToday: boolean
}

export function CashflowExpenseLineChart({
  transactions,
  shift = 0,
  className,
}: CashflowExpenseLineChartProps) {
  const chartId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Full-width tracking via ResizeObserver
  const [containerWidth, setContainerWidth] = useState<number>(640)

  useEffect(() => {
    if (!containerRef.current) return

    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.getBoundingClientRect().width
        if (w > 0) setContainerWidth(Math.round(w))
      }
    }

    updateWidth()

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width))
        }
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const [viewMode, setViewMode] = useState<ViewMode>('cum')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [isPointerDown, setIsPointerDown] = useState(false)

  // Target month calculation from shift
  const { year, month, daysInMonth, isCurrentMonth, currentDay, monthLabel } = useMemo(() => {
    const targetMonthDate = rangeBounds('month', shift).start
    const y = targetMonthDate.getFullYear()
    const m = targetMonthDate.getMonth()
    const days = new Date(y, m + 1, 0).getDate()

    const now = new Date()
    const isCur = now.getFullYear() === y && now.getMonth() === m
    const curDay = isCur ? now.getDate() : days

    const label = `Tháng ${m + 1}/${y}`

    return {
      year: y,
      month: m,
      daysInMonth: days,
      isCurrentMonth: isCur,
      currentDay: curDay,
      monthLabel: label,
    }
  }, [shift])

  // Aggregate expenses by day of the target month
  const { daySlots, stats, primaryCurrency } = useMemo(() => {
    // Map: dayNumber (1..daysInMonth) -> { amount, count }
    const dailyMap = new Map<number, { amount: number; count: number }>()

    let detectedCurrency = 'VND'

    transactions.forEach((tx) => {
      if (tx.type !== 'expense') return
      if (tx.currency) detectedCurrency = tx.currency

      const d = new Date(tx.transaction_time)
      if (isNaN(d.getTime())) return

      if (d.getFullYear() === year && d.getMonth() === month) {
        const dayNum = d.getDate()
        const current = dailyMap.get(dayNum) ?? { amount: 0, count: 0 }
        current.amount += tx.amount
        current.count += 1
        dailyMap.set(dayNum, current)
      }
    })

    let runningCumulative = 0
    let totalMonthExpense = 0
    let maxExpense = 0
    let maxExpenseDay = 1
    let daysWithExpenseCount = 0

    const slots: DaySlot[] = []

    for (let d = 1; d <= daysInMonth; d++) {
      const data = dailyMap.get(d) ?? { amount: 0, count: 0 }
      const isFuture = isCurrentMonth && d > currentDay
      const isToday = isCurrentMonth && d === currentDay

      if (!isFuture) {
        runningCumulative += data.amount
        totalMonthExpense += data.amount
      }

      if (data.amount > 0) {
        daysWithExpenseCount += 1
        if (data.amount > maxExpense) {
          maxExpense = data.amount
          maxExpenseDay = d
        }
      }

      const dateObj = new Date(year, month, d)
      const dayName = dateObj.toLocaleDateString('vi-VN', { weekday: 'short' })
      const padDay = String(d).padStart(2, '0')
      const padMonth = String(month + 1).padStart(2, '0')

      slots.push({
        dayNum: d,
        dateLabel: `${padDay}/${padMonth}`,
        fullDateLabel: `${dayName}, ${padDay}/${padMonth}/${year}`,
        expense: data.amount,
        cumExpense: runningCumulative,
        count: data.count,
        isFuture,
        isToday,
      })
    }

    const elapsedDays = Math.max(1, isCurrentMonth ? currentDay : daysInMonth)
    const avgPerDay = totalMonthExpense / elapsedDays

    return {
      daySlots: slots,
      primaryCurrency: detectedCurrency,
      stats: {
        totalMonthExpense,
        daysWithExpenseCount,
        maxExpense,
        maxExpenseDay,
        avgPerDay,
      },
    }
  }, [transactions, year, month, daysInMonth, isCurrentMonth, currentDay])

  // Geometry settings for SVG viewport based on dynamic containerWidth
  const viewWidth = Math.max(300, containerWidth)
  const viewHeight = 220
  const padding = { top: 28, bottom: 32, left: 40, right: 24 }
  const plotWidth = Math.max(10, viewWidth - padding.left - padding.right)
  const plotHeight = Math.max(10, viewHeight - padding.top - padding.bottom)

  // Generate SVG coordinates
  const chartCoordinates = useMemo(() => {
    if (daySlots.length === 0) return null

    const count = daySlots.length
    const getX = (idx: number) => padding.left + (idx / Math.max(count - 1, 1)) * plotWidth

    if (viewMode === 'daily') {
      const maxVal = Math.max(1000, stats.maxExpense * 1.15)
      const getY = (val: number) => padding.top + (1 - val / maxVal) * plotHeight
      const zeroY = getY(0)

      const coords = daySlots.map((slot, idx) => ({
        ...slot,
        x: getX(idx),
        y: getY(slot.expense),
      }))

      // Path for past / current days
      const validCoords = coords.filter((c) => !c.isFuture)
      const linePath = validCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
      
      const firstX = validCoords[0]?.x.toFixed(1) ?? padding.left.toFixed(1)
      const lastX = validCoords[validCoords.length - 1]?.x.toFixed(1) ?? (padding.left + plotWidth).toFixed(1)
      const areaPath = `${linePath} L ${lastX} ${zeroY.toFixed(1)} L ${firstX} ${zeroY.toFixed(1)} Z`

      return {
        type: 'daily' as const,
        coords,
        linePath,
        areaPath,
        zeroY,
        maxVal,
      }
    }

    if (viewMode === 'cum') {
      const maxVal = Math.max(1000, stats.totalMonthExpense * 1.12)
      const getY = (val: number) => padding.top + (1 - val / maxVal) * plotHeight
      const zeroY = getY(0)

      const coords = daySlots.map((slot) => {
        const x = padding.left + (slot.dayNum / daysInMonth) * plotWidth
        return {
          ...slot,
          x,
          y: getY(slot.cumExpense),
        }
      })

      const validCoords = coords.filter((c) => !c.isFuture)
      const startX = padding.left.toFixed(1)
      const lineSegments = validCoords.map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
      const linePath = `M ${startX} ${zeroY.toFixed(1)} ${lineSegments}`

      const lastX = validCoords[validCoords.length - 1]?.x.toFixed(1) ?? (padding.left + plotWidth).toFixed(1)
      const areaPath = `${linePath} L ${lastX} ${zeroY.toFixed(1)} Z`

      return {
        type: 'cum' as const,
        coords,
        linePath,
        areaPath,
        zeroY,
        maxVal,
      }
    }

    return null
  }, [daySlots, viewMode, stats, plotWidth, plotHeight, padding.left, padding.top, daysInMonth])

  // Exact 1:1 touch / pointer calculation
  const handlePointerAtX = useCallback(
    (clientX: number) => {
      if (!containerRef.current || !chartCoordinates || daySlots.length === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width === 0) return

      const relativeX = clientX - rect.left

      let closestIndex = 0
      let minDistance = Infinity

      chartCoordinates.coords.forEach((c, idx) => {
        const dist = Math.abs(relativeX - c.x)
        if (dist < minDistance) {
          minDistance = dist
          closestIndex = idx
        }
      })

      if (closestIndex !== activeIndex) {
        setActiveIndex(closestIndex)
        triggerHaptic()
      }
    },
    [chartCoordinates, daySlots.length, activeIndex]
  )

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsPointerDown(true)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Fallback
    }
    handlePointerAtX(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPointerDown || e.pointerType === 'mouse') {
      handlePointerAtX(e.clientX)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsPointerDown(false)
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // ignore
    }
  }

  const activeSlot = activeIndex !== null && daySlots[activeIndex] ? daySlots[activeIndex] : null

  // Gradient IDs
  const expenseAreaGradientId = `expense-area-${chartId}`
  const expenseLineGradientId = `expense-line-${chartId}`

  return (
    <Card className={cn('w-full overflow-hidden rounded-2xl border bg-card shadow-sm transition-all', className)}>
      <CardHeader className="space-y-3 pb-3 pt-4 px-4 sm:px-6">
        {/* Header Title & Controls */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
              <TrendingDown className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold leading-none tracking-tight">
                  Biểu đồ Tích lũy Chi tiêu
                </CardTitle>
                <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-medium">
                  {monthLabel}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Tổng chi tiêu tích lũy qua từng ngày trong tháng
              </p>
            </div>
          </div>

          {/* View Mode Segmented Control */}
          <div className="flex items-center rounded-lg bg-muted/80 p-0.5 text-[11px] font-medium text-muted-foreground self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('cum')}
              className={cn(
                'rounded-md px-2.5 py-1 transition-all active:scale-95',
                viewMode === 'cum'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'hover:text-foreground'
              )}
            >
              Lũy kế tháng
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={cn(
                'rounded-md px-2.5 py-1 transition-all active:scale-95',
                viewMode === 'daily'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'hover:text-foreground'
              )}
            >
              Từng ngày
            </button>
          </div>
        </div>

        {/* Live Inspection Header (Mobile-Friendly: Top placement prevents thumb occlusion) */}
        <div className="relative min-h-[52px] rounded-xl border bg-muted/30 p-2.5 transition-all">
          {activeSlot ? (
            <div className="flex flex-wrap items-center justify-between gap-2 animate-in fade-in-50 duration-150">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'font-mono text-[11px] px-2 py-0.5 font-bold',
                    activeSlot.isToday
                      ? 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                      : activeSlot.expense > 0
                      ? 'border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                      : 'border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {activeSlot.isToday ? 'HÔM NAY' : `NGÀY ${activeSlot.dayNum}`}
                </Badge>
                <div>
                  <span className="font-semibold text-xs sm:text-sm text-foreground">
                    {activeSlot.fullDateLabel}
                  </span>
                  <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                    {activeSlot.isFuture ? '(Chưa diễn ra)' : `(${activeSlot.count} giao dịch chi)`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {viewMode === 'cum' ? 'Lũy kế đến ngày này' : 'Chi tiêu ngày này'}
                  </div>
                  <div className="text-xs sm:text-sm font-bold money-blur font-mono text-rose-600 dark:text-rose-400">
                    {formatCurrency(viewMode === 'cum' ? activeSlot.cumExpense : activeSlot.expense, primaryCurrency)}
                  </div>
                </div>

                <div className="text-right border-l pl-3 border-border/60">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {viewMode === 'cum' ? 'Phát sinh ngày này' : 'Lũy kế đến ngày này'}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-foreground font-mono money-blur">
                    {formatCurrency(viewMode === 'cum' ? activeSlot.expense : activeSlot.cumExpense, primaryCurrency)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Default Overview Stats when not scrubbing
            <div className="flex flex-wrap items-center justify-between gap-y-1 text-xs">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Tổng chi tiêu {monthLabel}
                  </span>
                  <span className="text-sm font-bold money-blur font-mono text-rose-600 dark:text-rose-400">
                    {formatCurrency(stats.totalMonthExpense, primaryCurrency)}
                  </span>
                </div>

                <div className="border-l pl-3 border-border/60">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Trung bình mỗi ngày
                  </span>
                  <span className="text-sm font-bold font-mono money-blur text-foreground">
                    {formatCurrency(stats.avgPerDay, primaryCurrency)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {stats.maxExpense > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 border">
                    <Flame className="h-3 w-3 text-amber-500" />
                    Đỉnh điểm: Ngày {stats.maxExpenseDay} (
                    <strong className="text-rose-600 money-blur">{formatCurrency(stats.maxExpense, primaryCurrency)}</strong>)
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80 italic">
                  <Crosshair className="h-3 w-3" />
                  Chạm / rê để xem từng ngày
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-2 sm:px-6 pb-4 pt-1">
        {stats.totalMonthExpense === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            <Layers className="h-8 w-8 mb-2 stroke-1 text-muted-foreground/60" />
            <p className="text-sm font-medium">Chưa có giao dịch chi tiêu trong {monthLabel}</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
              Biểu đồ sẽ tự động vẽ đường chi tiêu khi có các giao dịch Expense được ghi nhận trong tháng này.
            </p>
          </div>
        ) : chartCoordinates ? (
          <div ref={containerRef} className="relative w-full select-none -webkit-user-select-none">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewWidth} ${viewHeight}`}
              className="w-full block overflow-visible cursor-crosshair touch-none"
              style={{
                width: '100%',
                height: `${viewHeight}px`,
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'none',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={() => {
                if (!isPointerDown) setActiveIndex(null)
              }}
            >
              <defs>
                <linearGradient id={expenseAreaGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
                  <stop offset="60%" stopColor="#f43f5e" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                </linearGradient>

                <linearGradient id={expenseLineGradientId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="100%" stopColor="#e11d48" />
                </linearGradient>
              </defs>

              {/* Zero Baseline */}
              <line
                x1={padding.left}
                x2={viewWidth - padding.right}
                y1={chartCoordinates.zeroY}
                y2={chartCoordinates.zeroY}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-muted-foreground/30"
                strokeWidth="1"
              />
              <text
                x={padding.left - 6}
                y={chartCoordinates.zeroY + 3}
                textAnchor="end"
                fontSize="9"
                fill="currentColor"
                className="text-muted-foreground/60 font-mono"
              >
                0 đ
              </text>

              {/* Area fill under curve */}
              <path d={chartCoordinates.areaPath} fill={`url(#${expenseAreaGradientId})`} />

              {/* Main Line */}
              <path
                d={chartCoordinates.linePath}
                fill="none"
                stroke={`url(#${expenseLineGradientId})`}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Daily spending dots & vertical guide stems */}
              {chartCoordinates.coords.map((c, i) => {
                if (c.isFuture) return null
                const isCurrentActive = activeIndex === i
                const hasExpense = c.expense > 0

                return (
                  <g key={`day-node-${i}`}>
                    {/* Vertical stem on days with spending in daily mode */}
                    {viewMode === 'daily' && hasExpense && (
                      <line
                        x1={c.x}
                        x2={c.x}
                        y1={chartCoordinates.zeroY}
                        y2={c.y}
                        stroke="#f43f5e"
                        strokeWidth="1.5"
                        strokeOpacity="0.3"
                      />
                    )}

                    {/* Point Circle */}
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isCurrentActive ? 5.5 : hasExpense ? 3.5 : 2}
                      fill={hasExpense ? '#f43f5e' : 'var(--muted-foreground, #94a3b8)'}
                      fillOpacity={hasExpense ? 1 : 0.4}
                      stroke="var(--background, #fff)"
                      strokeWidth="1.5"
                      className="transition-transform duration-100"
                    />
                  </g>
                )
              })}

              {/* Interactive Crosshair & Cursor indicator */}
              {activeIndex !== null && chartCoordinates.coords[activeIndex] && (
                <g>
                  {/* Vertical Crosshair Line */}
                  <line
                    x1={chartCoordinates.coords[activeIndex].x}
                    x2={chartCoordinates.coords[activeIndex].x}
                    y1={padding.top - 8}
                    y2={viewHeight - padding.bottom + 8}
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    className="text-rose-500/70"
                  />

                  {/* Highlight Outer Ring */}
                  <circle
                    cx={chartCoordinates.coords[activeIndex].x}
                    cy={chartCoordinates.coords[activeIndex].y}
                    r="9"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2.5"
                    strokeOpacity="0.8"
                    className="animate-pulse"
                  />
                </g>
              )}

              {/* Bottom Date Labels: Day 1, Day 15, Last Day */}
              {daySlots.length > 1 && (
                <g className="text-muted-foreground/60 text-[9px] font-mono">
                  <text x={padding.left} y={viewHeight - 10} textAnchor="start" fill="currentColor">
                    Ngày 1
                  </text>
                  <text x={padding.left + plotWidth / 2} y={viewHeight - 10} textAnchor="middle" fill="currentColor">
                    Ngày {Math.round(daysInMonth / 2)}
                  </text>
                  <text x={padding.left + plotWidth} y={viewHeight - 10} textAnchor="end" fill="currentColor">
                    Ngày {daysInMonth}
                  </text>
                </g>
              )}
            </svg>

            {/* Bottom Legend */}
            <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground px-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                  {viewMode === 'daily' ? 'Chi tiêu từng ngày' : 'Chi tiêu lũy kế tháng'}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground/70">
                  <span className="h-0.5 w-3 border-b border-dashed border-muted-foreground/60 inline-block" />
                  Mốc 0 đ
                </span>
              </div>

              <div className="ml-auto text-[10px] text-muted-foreground">
                <strong className="text-foreground">{stats.daysWithExpenseCount}</strong> / {daysInMonth} ngày có phát sinh chi
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
