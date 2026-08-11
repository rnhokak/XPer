import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, HandCoins, LineChart, Minus, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CashflowExpenseChart } from '@/features/cashflow/components/CashflowExpenseChart'
import {
  useCashflowReportTransactions,
  useCashflowTransactions,
  type CashflowTransaction,
} from '@/hooks/useCashflowTransactions'

export default function DashboardPage() {
  const range = 'month'
  const { data: currentTransactions = [], isLoading: currentLoading } = useCashflowTransactions(range, 0)
  const { data: previousTransactions = [], isLoading: previousLoading } = useCashflowTransactions(range, -1)
  const { data: reportTransactions = [], isLoading: reportLoading } = useCashflowReportTransactions()

  const summarize = (transactions: CashflowTransaction[]) =>
    transactions.reduce(
      (acc, tx) => {
        if (tx.type === 'income') acc.income += tx.amount
        if (tx.type === 'expense') acc.expense += tx.amount
        acc.count += 1
        return acc
      },
      { income: 0, expense: 0, count: 0 }
    )

  const currentSummary = useMemo(() => summarize(currentTransactions), [currentTransactions])
  const previousSummary = useMemo(() => summarize(previousTransactions), [previousTransactions])

  const currentNet = currentSummary.income - currentSummary.expense
  const previousNet = previousSummary.income - previousSummary.expense

  const compare = (current: number, previous: number) => {
    if (current === 0 && previous === 0) {
      return { diff: 0, pct: 0, trend: 'flat' as const }
    }
    if (previous === 0) {
      return { diff: current, pct: 100, trend: current >= 0 ? 'up' as const : 'down' as const }
    }
    const diff = current - previous
    const pct = (diff / Math.abs(previous)) * 100
    if (diff > 0) return { diff, pct, trend: 'up' as const }
    if (diff < 0) return { diff, pct, trend: 'down' as const }
    return { diff: 0, pct: 0, trend: 'flat' as const }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(value))

  const formatDiff = (value: number) => `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`

  const incomeCompare = compare(currentSummary.income, previousSummary.income)
  const expenseCompare = compare(currentSummary.expense, previousSummary.expense)
  const netCompare = compare(currentNet, previousNet)
  const countCompare = compare(currentSummary.count, previousSummary.count)

  const recentTransactions = useMemo(() => currentTransactions.slice(0, 5), [currentTransactions])
  const loading = currentLoading || previousLoading

  const renderTrend = (trend: 'up' | 'down' | 'flat') => {
    if (trend === 'up') return <ArrowUpRight className="h-4 w-4 text-emerald-600" />
    if (trend === 'down') return <ArrowDownRight className="h-4 w-4 text-rose-600" />
    return <Minus className="h-4 w-4 text-slate-400" />
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link to="/cashflow/new">
            Quick Add <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Income</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(currentSummary.income)} đ</div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {renderTrend(incomeCompare.trend)}
              <span>
                {formatDiff(incomeCompare.diff)} ({Math.abs(incomeCompare.pct).toFixed(0)}%)
              </span>
              <span>vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(currentSummary.expense)} đ</div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {renderTrend(expenseCompare.trend)}
              <span>
                {formatDiff(expenseCompare.diff)} ({Math.abs(expenseCompare.pct).toFixed(0)}%)
              </span>
              <span>vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net</CardTitle>
            <HandCoins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(currentNet)} đ</div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {renderTrend(netCompare.trend)}
              <span>
                {formatDiff(netCompare.diff)} ({Math.abs(netCompare.pct).toFixed(0)}%)
              </span>
              <span>vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold">{currentSummary.count}</div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {renderTrend(countCompare.trend)}
              <span>
                {countCompare.diff >= 0 ? '+' : ''}
                {countCompare.diff} ({Math.abs(countCompare.pct).toFixed(0)}%)
              </span>
              <span>vs last period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <div className="lg:col-span-4">
          {reportLoading ? (
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>Loading expense trends...</CardDescription>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ) : (
            <CashflowExpenseChart transactions={reportTransactions} />
          )}
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest cashflow transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && recentTransactions.length === 0 ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity. Add a transaction to get started.</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => {
                  const label = tx.category?.name ?? tx.note ?? 'Transaction'
                  const amount = formatCurrency(tx.amount)
                  const isIncome = tx.type === 'income'
                  const dateLabel = new Date(tx.transaction_time).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: 'short',
                  })
                  return (
                    <div key={tx.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{dateLabel}</p>
                      </div>
                      <p className={`text-sm font-semibold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIncome ? '+' : '-'}
                        {amount} đ
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
