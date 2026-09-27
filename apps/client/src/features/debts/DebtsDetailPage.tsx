import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { DebtPaymentForm } from './components/DebtPaymentForm'
import { useAuth } from '@/hooks/useAuth'
import {
  computeOutstandingPrincipal,
  type Account,
  type Category,
  type DebtDetailPaymentRow,
  type DebtRow,
  useDebtDetailData,
} from '@/hooks/useDebtsData'

export default function DebtsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const { data, isLoading, error } = useDebtDetailData(user?.id ?? '', id)

  if (!id) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        Missing debt id.
      </div>
    )
  }

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
        Failed to load debt details. Please try again.
      </div>
    )
  }

  const debt = data?.debt as DebtRow | null
  if (!debt) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        Debt not found.
      </div>
    )
  }

  const paymentRows: DebtDetailPaymentRow[] = data?.payments ?? []
  const accounts: Account[] = data?.accounts ?? []
  const categories: Category[] = data?.categories ?? []

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null
  const remainingPrincipal = computeOutstandingPrincipal(debt.direction as 'lend' | 'borrow', debt.principal_amount, paymentRows)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Chi tiết khoản {debt.direction === 'lend' ? 'cho vay' : 'đi vay'}</p>
          <h1 className="text-2xl font-semibold">{debt.partner?.name ?? 'Không rõ đối tác'}</h1>
          <p className="text-sm text-muted-foreground">Bắt đầu {new Date(debt.start_date).toLocaleDateString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{debt.direction === 'lend' ? 'Cho vay' : 'Đi vay'}</Badge>
          <Badge>{debt.status}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link to="/debts">Quay lại</Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Thông tin chính</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Gốc ban đầu</p>
              <p className="text-lg font-semibold">
                {debt.principal_amount.toLocaleString()} {debt.currency}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Còn lại</p>
              <p className="text-lg font-semibold">
                {remainingPrincipal.toLocaleString()} {debt.currency}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Bắt đầu</p>
              <p className="text-sm font-medium">{new Date(debt.start_date).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Đến hạn</p>
              <p className="text-sm font-medium">{debt.due_date ? new Date(debt.due_date).toLocaleDateString() : 'Không'}</p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Chi tiết lãi suất</p>
            <p className="text-sm text-muted-foreground">
              Loại: {debt.interest_type}
              {debt.interest_rate ? ` · ${debt.interest_rate}${debt.interest_type === 'percent' ? '%' : ''}` : ''}
              {debt.interest_cycle ? ` / ${debt.interest_cycle}` : ''}
            </p>
            <p className="text-sm font-semibold">Ghi chú</p>
            <p className="text-sm text-muted-foreground">{debt.description || '—'}</p>
            <p className="text-sm font-semibold">Liên hệ</p>
            <p className="text-sm text-muted-foreground">{debt.partner?.phone ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <DebtPaymentForm
        debtId={debt.id}
        direction={debt.direction as 'lend' | 'borrow'}
        currency={debt.currency}
        defaultAccountId={defaultAccount?.id}
        accounts={accounts}
        categories={categories}
        remainingPrincipal={remainingPrincipal}
      />

      <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Lịch sử thanh toán</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3 md:hidden">
            {paymentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có giao dịch nào.</p>
            ) : (
              paymentRows.map((p) => (
                <div key={p.id} className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant={p.payment_type === 'disbursement' ? 'secondary' : 'default'}>{p.payment_type}</Badge>
                    <p className="text-xs text-muted-foreground">{new Date(p.payment_date).toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Số tiền</p>
                      <p className="font-semibold">
                        {p.amount.toLocaleString()} {p.transaction?.currency ?? debt.currency}
                      </p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2">
                      <p className="text-xs text-emerald-700">Gốc</p>
                      <p className="font-semibold text-emerald-700">{(p.principal_amount ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 px-3 py-2">
                      <p className="text-xs text-amber-700">Lãi</p>
                      <p className="font-semibold text-amber-700">{(p.interest_amount ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.transaction ? (
                      <div>
                        <p className="font-semibold text-foreground">{p.transaction.type}</p>
                        <p>
                          {p.transaction.account?.name ?? '—'} {p.transaction.category?.name ? `· ${p.transaction.category?.name}` : ''}
                        </p>
                      </div>
                    ) : (
                      '—'
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{p.note || p.transaction?.note || '—'}</p>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead className="text-right">Gốc</TableHead>
                    <TableHead className="text-right">Lãi</TableHead>
                    <TableHead>Cashflow</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        Chưa có giao dịch nào.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paymentRows.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Badge variant={p.payment_type === 'disbursement' ? 'secondary' : 'default'}>{p.payment_type}</Badge>
                        </TableCell>
                        <TableCell>{new Date(p.payment_date).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {p.amount.toLocaleString()} {p.transaction?.currency ?? debt.currency}
                        </TableCell>
                        <TableCell className="text-right">{(p.principal_amount ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{(p.interest_amount ?? 0).toLocaleString()}</TableCell>
                        <TableCell>
                          {p.transaction ? (
                            <div className="text-sm">
                              <div className="font-semibold">{p.transaction.type}</div>
                              <div className="text-xs text-muted-foreground">
                                {p.transaction.account?.name ?? '—'} {p.transaction.category?.name ? `· ${p.transaction.category?.name}` : ''}
                              </div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="max-w-[280px] whitespace-pre-wrap text-sm text-muted-foreground">
                          {p.note || p.transaction?.note || '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
