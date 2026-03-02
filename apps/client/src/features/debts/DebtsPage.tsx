import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { DebtQuickAddDialog } from './components/DebtQuickAddDialog'
import { DebtsTable } from './components/DebtsTable'
import { useAuth } from '@/hooks/useAuth'
import { useDebtsOverviewData } from '@/hooks/useDebtsData'

export default function DebtsPage() {
  const { user, loading: authLoading } = useAuth()
  const { data, isLoading, error } = useDebtsOverviewData(user?.id ?? '')

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
        Failed to load debts data. Please try again.
      </div>
    )
  }

  const partners = data?.partners ?? []
  const accounts = data?.accounts ?? []
  const categories = data?.categories ?? []
  const debts = data?.debts ?? []

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null
  const defaultCurrency = defaultAccount?.currency ?? 'VND'

  const totalLendOutstanding = debts
    .filter((d) => d.direction === 'lend' && d.status !== 'paid_off')
    .reduce((sum, d) => sum + (d.outstanding_principal ?? d.principal_amount), 0)
  const totalBorrowOutstanding = debts
    .filter((d) => d.direction === 'borrow' && d.status !== 'paid_off')
    .reduce((sum, d) => sum + (d.outstanding_principal ?? d.principal_amount), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Quản lý cho vay/đi vay và tự động ghi nhận cashflow.</p>
          <h1 className="text-2xl font-semibold">Debts</h1>
        </div>
        <Button asChild>
          <Link to="/debts/new">Thêm khoản vay mới</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>Tổng kết nhanh</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Đang cho vay</p>
              <p className="mt-1 text-2xl font-semibold">
                {totalLendOutstanding.toLocaleString()}{' '}
                <span className="text-base font-normal text-muted-foreground">{defaultCurrency}</span>
              </p>
              <Badge className="mt-2" variant="outline">
                {debts.filter((d) => d.direction === 'lend').length} khoản
              </Badge>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Đang đi vay</p>
              <p className="mt-1 text-2xl font-semibold">
                {totalBorrowOutstanding.toLocaleString()}{' '}
                <span className="text-base font-normal text-muted-foreground">{defaultCurrency}</span>
              </p>
              <Badge className="mt-2" variant="outline">
                {debts.filter((d) => d.direction === 'borrow').length} khoản
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>Quản lý đối tác</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Thêm người/đơn vị liên quan tới khoản vay ở màn riêng.</p>
            <Button asChild variant="outline">
              <Link to="/debts/partners">Mở màn Đối tác</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <DebtQuickAddDialog
        partners={partners}
        accounts={accounts}
        categories={categories}
        defaultAccountId={defaultAccount?.id}
        defaultCurrency={defaultCurrency}
      />

      <DebtsTable debts={debts} />
    </div>
  )
}
