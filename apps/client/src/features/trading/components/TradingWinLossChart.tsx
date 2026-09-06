import { useId, useMemo, useRef, useState, useCallback, useEffect } from 'react'
import {
  TrendingUp,
  Layers,
  Crosshair,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type TradingOrderForChart = {
  id: string
  ticket?: string | null
  symbol: string
  side: 'buy' | 'sell'
  volume: number
  entry_price?: number | null
  close_price?: number | null
  commission_usd?: number | null
  swap_usd?: number | null
  status: 'open' | 'closed' | 'cancelled'
  open_time: string
  close_time?: string | null
  pnl_amount?: number | null
  pnl_percent?: number | null
  note?: string | null
  balance_account_id?: string
  is_imported?: boolean
}

type ViewMode = 'cum' | 'daily' | 'winloss'
type RangeOption = 'all' | '30' | '14' | '7'

interface TradingWinLossChartProps {
  orders: TradingOrderForChart[]
  currency?: string
  className?: string
}

const formatMoney = (val: number, currency = 'USD') => {
  const prefix = val > 0 ? '+' : val < 0 ? '-' : ''
  const abs = Math.abs(val)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const sym = currency === 'USD' ? '$' : currency === 'VND' ? '₫' : `${currency} `
  return `${prefix}${sym}${formatted}`
}

const toDateKey = (dateStr?: string | null) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateShort = (dateKey: string) => {
  if (!dateKey) return '—'
  const parts = dateKey.split('-')
  if (parts.length < 3) return dateKey
  return `${parts[2]}/${parts[1]}`
}

const formatDateFull = (dateKey: string) => {
  if (!dateKey) return '—'
  const parts = dateKey.split('-')
  if (parts.length < 3) return dateKey
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

const triggerHaptic = () => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8)
    } catch {
      // Safely ignore on unsupported browsers
    }
  }
}

type DayPoint = {
  index: number
  isBaseline: boolean
  dateKey: string
  dateLabel: string
  fullDateLabel: string
  dailyPnl: number
  cumPnl: number
  ordersCount: number
  winsCount: number
  lossesCount: number
  isWinDay: boolean
  isLossDay: boolean
  cumWinDays: number
  cumLossDays: number
}

export function TradingWinLossChart({ orders, currency = 'USD', className }: TradingWinLossChartProps) {
  const chartId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Dynamically track container width for true full-width responsiveness & 1:1 mouse tracking
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
  const [range, setRange] = useState<RangeOption>('30')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [isPointerDown, setIsPointerDown] = useState(false)

  // 1. Group closed orders by day (Theo ngày) and calculate total money
  const { points, stats } = useMemo(() => {
    const closed = orders.filter((o) => o.status === 'closed')

    // Group orders by local date
    const dayMap = new Map<
      string,
      {
        totalPnl: number
        orders: TradingOrderForChart[]
        wins: number
        losses: number
        breakevens: number
      }
    >()

    closed.forEach((o) => {
      const time = o.close_time || o.open_time
      const key = toDateKey(time)
      if (!key) return

      const comm = Number(o.commission_usd ?? 0) + Number(o.swap_usd ?? 0)
      const netPnl = Number(o.pnl_amount ?? 0) + comm
      const isWin = netPnl > 0
      const isLoss = netPnl < 0

      const existing = dayMap.get(key) ?? {
        totalPnl: 0,
        orders: [],
        wins: 0,
        losses: 0,
        breakevens: 0,
      }

      existing.totalPnl += netPnl
      existing.orders.push(o)
      if (isWin) existing.wins += 1
      else if (isLoss) existing.losses += 1
      else existing.breakevens += 1

      dayMap.set(key, existing)
    })

    // Sort dates chronologically (oldest to newest)
    const sortedDateKeys = Array.from(dayMap.keys()).sort((a, b) => a.localeCompare(b))

    const targetDateKeys =
      range === '7'
        ? sortedDateKeys.slice(-7)
        : range === '14'
        ? sortedDateKeys.slice(-14)
        : range === '30'
        ? sortedDateKeys.slice(-30)
        : sortedDateKeys

    let runningPnl = 0
    let runningWinDays = 0
    let runningLossDays = 0
    let maxWinStreak = 0
    let currentWinStreak = 0

    // Initial baseline point (Day 0 at 0 PnL)
    const initialPoint: DayPoint = {
      index: 0,
      isBaseline: true,
      dateKey: targetDateKeys[0] || '',
      dateLabel: targetDateKeys[0] ? formatDateShort(targetDateKeys[0]) : '',
      fullDateLabel: targetDateKeys[0] ? formatDateFull(targetDateKeys[0]) : '',
      dailyPnl: 0,
      cumPnl: 0,
      ordersCount: 0,
      winsCount: 0,
      lossesCount: 0,
      isWinDay: false,
      isLossDay: false,
      cumWinDays: 0,
      cumLossDays: 0,
    }

    let bestDayPnl = -Infinity
    let worstDayPnl = Infinity

    const calculatedPoints: DayPoint[] = targetDateKeys.map((dateKey, idx) => {
      const data = dayMap.get(dateKey)!
      const dailyPnl = data.totalPnl
      runningPnl += dailyPnl

      const isWinDay = dailyPnl > 0
      const isLossDay = dailyPnl < 0

      if (isWinDay) {
        runningWinDays += 1
        currentWinStreak += 1
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak
      } else {
        currentWinStreak = 0
        if (isLossDay) runningLossDays += 1
      }

      if (dailyPnl > bestDayPnl) bestDayPnl = dailyPnl
      if (dailyPnl < worstDayPnl) worstDayPnl = dailyPnl

      return {
        index: idx + 1,
        isBaseline: false,
        dateKey,
        dateLabel: formatDateShort(dateKey),
        fullDateLabel: formatDateFull(dateKey),
        dailyPnl,
        cumPnl: runningPnl,
        ordersCount: data.orders.length,
        winsCount: data.wins,
        lossesCount: data.losses,
        isWinDay,
        isLossDay,
        cumWinDays: runningWinDays,
        cumLossDays: runningLossDays,
      }
    })

    const allPoints = targetDateKeys.length > 0 ? [initialPoint, ...calculatedPoints] : []
    const totalDays = targetDateKeys.length
    const winDaysRate = totalDays > 0 ? Math.round((runningWinDays / totalDays) * 100) : 0

    return {
      points: allPoints,
      stats: {
        totalDays,
        totalOrders: targetDateKeys.reduce((sum, k) => sum + (dayMap.get(k)?.orders.length ?? 0), 0),
        runningWinDays,
        runningLossDays,
        winDaysRate,
        totalNetPnl: runningPnl,
        maxWinStreak,
        bestDay: totalDays > 0 ? bestDayPnl : 0,
        worstDay: totalDays > 0 ? worstDayPnl : 0,
      },
    }
  }, [orders, range])

  // Geometry settings for SVG viewport based on dynamic containerWidth
  const viewWidth = Math.max(300, containerWidth)
  const viewHeight = 220
  const padding = { top: 28, bottom: 32, left: 36, right: 24 }
  const plotWidth = Math.max(10, viewWidth - padding.left - padding.right)
  const plotHeight = Math.max(10, viewHeight - padding.top - padding.bottom)

  // Generate coordinates based on active ViewMode
  const chartCoordinates = useMemo(() => {
    if (points.length === 0) return null

    const count = points.length
    const getX = (idx: number) => padding.left + (idx / Math.max(count - 1, 1)) * plotWidth

    if (viewMode === 'cum') {
      const values = points.map((p) => p.cumPnl)
      const minVal = Math.min(0, ...values)
      const maxVal = Math.max(0, ...values)
      const diff = maxVal - minVal || 1
      const padDiff = diff * 0.12
      const domainMin = minVal - padDiff
      const domainMax = maxVal + padDiff
      const domainRange = domainMax - domainMin || 1

      const getY = (val: number) => padding.top + (1 - (val - domainMin) / domainRange) * plotHeight
      const zeroY = getY(0)

      const coords = points.map((p, idx) => ({
        ...p,
        x: getX(idx),
        y: getY(p.cumPnl),
      }))

      const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
      const firstX = coords[0].x.toFixed(1)
      const lastX = coords[coords.length - 1].x.toFixed(1)
      const areaPath = `${linePath} L ${lastX} ${zeroY.toFixed(1)} L ${firstX} ${zeroY.toFixed(1)} Z`

      return {
        type: 'cum' as const,
        coords,
        linePath,
        areaPath,
        zeroY,
      }
    }

    if (viewMode === 'daily') {
      const dailyPoints = points.filter((p) => !p.isBaseline)
      const dailyValues = dailyPoints.map((p) => p.dailyPnl)
      const minVal = Math.min(0, ...dailyValues)
      const maxVal = Math.max(0, ...dailyValues)
      const diff = maxVal - minVal || 1
      const padDiff = diff * 0.15
      const domainMin = minVal - padDiff
      const domainMax = maxVal + padDiff
      const domainRange = domainMax - domainMin || 1

      const getY = (val: number) => padding.top + (1 - (val - domainMin) / domainRange) * plotHeight
      const zeroY = getY(0)

      const coords = points.map((p, idx) => ({
        ...p,
        x: getX(idx),
        y: getY(p.isBaseline ? 0 : p.dailyPnl),
      }))

      const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
      const firstX = coords[0].x.toFixed(1)
      const lastX = coords[coords.length - 1].x.toFixed(1)
      const areaPath = `${linePath} L ${lastX} ${zeroY.toFixed(1)} L ${firstX} ${zeroY.toFixed(1)} Z`

      return {
        type: 'daily' as const,
        coords,
        linePath,
        areaPath,
        zeroY,
      }
    }

    // viewMode === 'winloss' (Cumulative Win Days vs Loss Days)
    const maxCount = Math.max(1, ...points.map((p) => Math.max(p.cumWinDays, p.cumLossDays)))
    const getY = (val: number) => padding.top + (1 - val / maxCount) * plotHeight

    const winCoords = points.map((p, idx) => ({
      ...p,
      x: getX(idx),
      y: getY(p.cumWinDays),
    }))

    const lossCoords = points.map((p, idx) => ({
      ...p,
      x: getX(idx),
      y: getY(p.cumLossDays),
    }))

    const winPath = winCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
    const lossPath = lossCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

    return {
      type: 'winloss' as const,
      winCoords,
      lossCoords,
      winPath,
      lossPath,
      maxCount,
    }
  }, [points, viewMode, plotWidth, plotHeight, padding.left, padding.top])

  // Pixel-perfect touch / pointer calculation matching exact point coordinates
  const handlePointerAtX = useCallback(
    (clientX: number) => {
      if (!containerRef.current || points.length === 0) return
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width === 0) return

      // Relative pixel position inside container
      const relativeX = clientX - rect.left

      if (points.length <= 1) {
        setActiveIndex(0)
        return
      }

      // Find the point whose X coordinate is closest to the cursor
      let closestIndex = 0
      let minDistance = Infinity

      points.forEach((_, idx) => {
        const pointX = padding.left + (idx / (points.length - 1)) * plotWidth
        const dist = Math.abs(relativeX - pointX)
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
    [points, plotWidth, padding.left, activeIndex]
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

  const activePoint = activeIndex !== null && points[activeIndex] ? points[activeIndex] : null

  // Gradients IDs
  const pnlAreaGradientId = `pnl-area-${chartId}`
  const pnlLineGradientId = `pnl-line-${chartId}`

  return (
    <Card className={cn('w-full overflow-hidden rounded-2xl border bg-card shadow-sm transition-all', className)}>
      <CardHeader className="space-y-3 pb-3 pt-4 px-4 sm:px-6">
        {/* Top Header Controls: Title & View Modes */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-none tracking-tight">
                Biểu đồ Win / Loss theo ngày
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Tổng số tiền lời / lỗ và hiệu suất giao dịch theo từng ngày
              </p>
            </div>
          </div>

          {/* iOS Segmented Controls for Mode & Range */}
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
            {/* Range selection */}
            <div className="flex items-center rounded-lg bg-muted/80 p-0.5 text-[11px] font-medium text-muted-foreground">
              <button
                type="button"
                onClick={() => setRange('all')}
                className={cn(
                  'rounded-md px-2 py-1 transition-all active:scale-95',
                  range === 'all'
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'hover:text-foreground'
                )}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setRange('30')}
                className={cn(
                  'rounded-md px-2 py-1 transition-all active:scale-95',
                  range === '30'
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'hover:text-foreground'
                )}
              >
                30 ngày
              </button>
              <button
                type="button"
                onClick={() => setRange('14')}
                className={cn(
                  'rounded-md px-2 py-1 transition-all active:scale-95',
                  range === '14'
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'hover:text-foreground'
                )}
              >
                14 ngày
              </button>
              <button
                type="button"
                onClick={() => setRange('7')}
                className={cn(
                  'rounded-md px-2 py-1 transition-all active:scale-95',
                  range === '7'
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'hover:text-foreground'
                )}
              >
                7 ngày
              </button>
            </div>

            {/* View Mode selection */}
            <div className="flex items-center rounded-lg bg-muted/80 p-0.5 text-[11px] font-medium text-muted-foreground">
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
                Lũy kế theo ngày
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
                Tổng từng ngày
              </button>
              <button
                type="button"
                onClick={() => setViewMode('winloss')}
                className={cn(
                  'rounded-md px-2.5 py-1 transition-all active:scale-95',
                  viewMode === 'winloss'
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'hover:text-foreground'
                )}
              >
                Ngày Thắng/Thua
              </button>
            </div>
          </div>
        </div>

        {/* Live Inspection Header (Mobile-First: Never covered by thumb) */}
        <div className="relative min-h-[52px] rounded-xl border bg-muted/30 p-2.5 transition-all">
          {activePoint && !activePoint.isBaseline ? (
            <div className="flex flex-wrap items-center justify-between gap-2 animate-in fade-in-50 duration-150">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'font-mono text-[11px] px-2 py-0.5 font-bold',
                    activePoint.isWinDay
                      ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : activePoint.isLossDay
                      ? 'border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                      : 'border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {activePoint.isWinDay ? 'NGÀY THẮNG' : activePoint.isLossDay ? 'NGÀY THUA' : 'HÒA VỐN'}
                </Badge>
                <div>
                  <span className="font-semibold text-xs sm:text-sm text-foreground">
                    {activePoint.fullDateLabel}
                  </span>
                  <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                    ({activePoint.ordersCount} lệnh: {activePoint.winsCount}W · {activePoint.lossesCount}L)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tổng tiền ngày này</div>
                  <div
                    className={cn(
                      'text-xs sm:text-sm font-bold money-blur font-mono',
                      activePoint.dailyPnl > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : activePoint.dailyPnl < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    {formatMoney(activePoint.dailyPnl, currency)}
                  </div>
                </div>

                <div className="text-right border-l pl-3 border-border/60">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {viewMode === 'winloss' ? 'Tích lũy Ngày' : 'P&L Lũy kế đến ngày này'}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-foreground font-mono">
                    {viewMode === 'winloss' ? (
                      <>
                        <span className="text-emerald-600">{activePoint.cumWinDays}W</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-rose-600">{activePoint.cumLossDays}L</span>
                      </>
                    ) : (
                      <span className="money-blur">{formatMoney(activePoint.cumPnl, currency)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : activePoint && activePoint.isBaseline ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground py-1">
              <span className="font-medium text-foreground">Điểm mốc ban đầu (Baseline)</span>
              <span>Tổng tiền: {formatMoney(0, currency)}</span>
            </div>
          ) : (
            // Default Overview Stats when not scrubbing
            <div className="flex flex-wrap items-center justify-between gap-y-1 text-xs">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Tổng P&L ({stats.totalDays} ngày · {stats.totalOrders} lệnh)
                  </span>
                  <span
                    className={cn(
                      'text-sm font-bold money-blur font-mono',
                      stats.totalNetPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {formatMoney(stats.totalNetPnl, currency)}
                  </span>
                </div>

                <div className="border-l pl-3 border-border/60">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Ngày Thắng / Thua
                  </span>
                  <span className="text-sm font-bold font-mono">
                    <span className="text-emerald-600 dark:text-emerald-400">{stats.runningWinDays} ngày Thắng</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-rose-600 dark:text-rose-400">{stats.runningLossDays} ngày Thua</span>
                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">({stats.winDaysRate}%)</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="hidden sm:inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 border">
                  Ngày cao nhất: <strong className="text-emerald-600">{formatMoney(stats.bestDay, currency)}</strong>
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80 italic">
                  <Crosshair className="h-3 w-3" />
                  Chạm / rê ngón tay để xem từng ngày
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-2 sm:px-6 pb-4 pt-1">
        {points.length <= 1 ? (
          <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            <Layers className="h-8 w-8 mb-2 stroke-1 text-muted-foreground/60" />
            <p className="text-sm font-medium">Chưa có dữ liệu ngày giao dịch để hiển thị</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
              Biểu đồ sẽ tự động tính tổng số tiền theo ngày khi có các lệnh đã đóng (Closed).
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
                <linearGradient id={pnlAreaGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="50%" stopColor="#10b981" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.15" />
                </linearGradient>

                <linearGradient id={pnlLineGradientId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor={stats.totalNetPnl >= 0 ? '#10b981' : '#f43f5e'} />
                </linearGradient>
              </defs>

              {/* Grid Zero Reference Line */}
              {(chartCoordinates.type === 'cum' || chartCoordinates.type === 'daily') && (
                <>
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
                    x={padding.left - 4}
                    y={chartCoordinates.zeroY + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill="currentColor"
                    className="text-muted-foreground/60 font-mono"
                  >
                    $0
                  </text>
                </>
              )}

              {/* Curves & Points: Cumulative P&L By Day */}
              {chartCoordinates.type === 'cum' && (
                <>
                  <path d={chartCoordinates.areaPath} fill={`url(#${pnlAreaGradientId})`} />
                  <path
                    d={chartCoordinates.linePath}
                    fill="none"
                    stroke={`url(#${pnlLineGradientId})`}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chartCoordinates.coords.map((c, i) => {
                    if (c.isBaseline) return null
                    const isWin = c.isWinDay
                    const isLoss = c.isLossDay
                    const isCurrentActive = activeIndex === i

                    return (
                      <circle
                        key={`cum-day-dot-${i}`}
                        cx={c.x}
                        cy={c.y}
                        r={isCurrentActive ? 5.5 : 3.5}
                        fill={isWin ? '#10b981' : isLoss ? '#f43f5e' : '#94a3b8'}
                        stroke="var(--background, #fff)"
                        strokeWidth="1.5"
                        className="transition-transform duration-100"
                      />
                    )
                  })}
                </>
              )}

              {/* Curves & Points: Daily Total P&L */}
              {chartCoordinates.type === 'daily' && (
                <>
                  <path d={chartCoordinates.areaPath} fill={`url(#${pnlAreaGradientId})`} />
                  <path
                    d={chartCoordinates.linePath}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chartCoordinates.coords.map((c, i) => {
                    if (c.isBaseline) return null
                    const isWin = c.isWinDay
                    const isLoss = c.isLossDay
                    const isCurrentActive = activeIndex === i

                    return (
                      <g key={`daily-dot-${i}`}>
                        {/* Vertical bar from zero baseline to dot */}
                        <line
                          x1={c.x}
                          x2={c.x}
                          y1={chartCoordinates.zeroY}
                          y2={c.y}
                          stroke={isWin ? '#10b981' : isLoss ? '#f43f5e' : '#94a3b8'}
                          strokeWidth="2"
                          strokeOpacity="0.4"
                        />
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r={isCurrentActive ? 5.5 : 3.5}
                          fill={isWin ? '#10b981' : isLoss ? '#f43f5e' : '#94a3b8'}
                          stroke="var(--background, #fff)"
                          strokeWidth="1.5"
                        />
                      </g>
                    )
                  })}
                </>
              )}

              {/* Curves & Points: Win Days vs Loss Days */}
              {chartCoordinates.type === 'winloss' && (
                <>
                  <path
                    d={chartCoordinates.winPath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={chartCoordinates.lossPath}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chartCoordinates.winCoords.map((c, i) => (
                    <circle
                      key={`winday-dot-${i}`}
                      cx={c.x}
                      cy={c.y}
                      r={activeIndex === i ? 5 : 3}
                      fill="#10b981"
                      stroke="var(--background, #fff)"
                      strokeWidth="1"
                    />
                  ))}
                  {chartCoordinates.lossCoords.map((c, i) => (
                    <circle
                      key={`lossday-dot-${i}`}
                      cx={c.x}
                      cy={c.y}
                      r={activeIndex === i ? 5 : 3}
                      fill="#f43f5e"
                      stroke="var(--background, #fff)"
                      strokeWidth="1"
                    />
                  ))}
                </>
              )}

              {/* Interactive Crosshair & Cursor indicator */}
              {activeIndex !== null && points[activeIndex] && (
                <g>
                  {/* Vertical Crosshair Line */}
                  <line
                    x1={padding.left + (activeIndex / Math.max(points.length - 1, 1)) * plotWidth}
                    x2={padding.left + (activeIndex / Math.max(points.length - 1, 1)) * plotWidth}
                    y1={padding.top - 8}
                    y2={viewHeight - padding.bottom + 8}
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    className="text-primary/70"
                  />

                  {/* Highlight Outer Ring */}
                  {(() => {
                    const x = padding.left + (activeIndex / Math.max(points.length - 1, 1)) * plotWidth
                    let y = padding.top + plotHeight / 2
                    if ((chartCoordinates.type === 'cum' || chartCoordinates.type === 'daily') && chartCoordinates.coords[activeIndex]) {
                      y = chartCoordinates.coords[activeIndex].y
                    } else if (chartCoordinates.type === 'winloss' && chartCoordinates.winCoords[activeIndex]) {
                      y = chartCoordinates.winCoords[activeIndex].y
                    }

                    return (
                      <circle
                        cx={x}
                        cy={y}
                        r="9"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeOpacity="0.8"
                        className="animate-pulse"
                      />
                    )
                  })()}
                </g>
              )}

              {/* Bottom Date Labels */}
              {points.length > 1 && (
                <g className="text-muted-foreground/60 text-[9px] font-mono">
                  <text x={padding.left} y={viewHeight - 10} textAnchor="start" fill="currentColor">
                    {points[0]?.dateLabel}
                  </text>
                  <text x={padding.left + plotWidth / 2} y={viewHeight - 10} textAnchor="middle" fill="currentColor">
                    {points[Math.floor(points.length / 2)]?.dateLabel}
                  </text>
                  <text x={padding.left + plotWidth} y={viewHeight - 10} textAnchor="end" fill="currentColor">
                    {points[points.length - 1]?.dateLabel}
                  </text>
                </g>
              )}
            </svg>

            {/* Bottom Legend for modes */}
            <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground px-2">
              {viewMode === 'cum' && (
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                    Ngày có lãi (Win Day)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                    Ngày lỗ (Loss Day)
                  </span>
                </div>
              )}

              {viewMode === 'daily' && (
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                    Đường tổng tiền từng ngày
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground/70">
                    <span className="h-0.5 w-3 border-b border-dashed border-muted-foreground/60 inline-block" />
                    Mốc hòa vốn $0
                  </span>
                </div>
              )}

              {viewMode === 'winloss' && (
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                    Số ngày Thắng tích lũy
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                    Số ngày Thua tích lũy
                  </span>
                </div>
              )}

              <div className="ml-auto text-[10px] text-muted-foreground">
                Tổng: <strong className="text-foreground">{stats.totalDays}</strong> ngày giao dịch
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
