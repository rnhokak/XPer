import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { normalizeCashflowRange, normalizeRangeShift } from '@/lib/cashflow/utils'
import { PieChartIcon, Loader2 } from 'lucide-react'
import { TransactionByCategoryReport } from './components/TransactionByCategoryReport'
import { useAuth } from '@/hooks/useAuth'
import { useReportsData } from '@/hooks/useReportsData'

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const range = normalizeCashflowRange(searchParams.get('range') ?? undefined)
  const shift = normalizeRangeShift(searchParams.get('shift') ?? undefined)

  const { data, isLoading, error } = useReportsData(range, shift, user?.id ?? '')

  if (authLoading || isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        Failed to load reports data. Please try again.
      </div>
    )
  }

  const transactions = data?.transactions ?? []
  const categories = data?.categories ?? []

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Báo cáo giao dịch theo danh mục</h1>
          <p className="text-sm text-muted-foreground">Phân tích chi tiêu/thu nhập theo danh mục hàng tháng.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Tổng quan theo danh mục
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionByCategoryReport
            transactions={transactions}
            categories={categories}
            range={range}
            shift={shift}
          />
        </CardContent>
      </Card>
    </div>
  )
}
