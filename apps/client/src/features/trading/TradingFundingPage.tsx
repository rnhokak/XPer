import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { fundingFormSchema, type FundingFormValues } from '@/lib/validation/trading'
import { useNotificationsStore } from '@/store/notifications'
import { useFundingHistory, useCreateFunding, useUpdateFunding, useDeleteFunding } from '@/hooks/useTradingData'
import { useBalanceAccounts } from '@/hooks/useTradingData'
import { Loader2 } from 'lucide-react'

type FundingRow = {
  id: string
  user_id: string
  balance_account_id: string
  type: 'deposit' | 'withdraw'
  amount: number
  currency: string
  method: string
  note: string | null
  transaction_time: string
  created_at: string
  updated_at: string
}

const toLocalInput = (isoString: string) => {
  const date = new Date(isoString)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const defaultDateTimeValue = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const toInputDateTime = (value?: string | null) => (value ? toLocalInput(value) : defaultDateTimeValue())

const currencyFormatter = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(amount)

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—'

type FundingFormInput = Omit<FundingFormValues, 'amount'> & { amount?: number }

const methodOptions = ['Bank transfer', 'Wallet', 'Broker transfer', 'Refund']

export default function TradingFundingPage() {
  const notify = useNotificationsStore((state) => state.notify)
  const { data: initialData = [], isLoading, error } = useFundingHistory()
  const { data: fundingAccounts = [] } = useBalanceAccounts()
  const createMutation = useCreateFunding()
  const updateMutation = useUpdateFunding()
  const deleteMutation = useDeleteFunding()
  
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<FundingRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FundingRow | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [mounted, setMounted] = useState(false)
  const [activeBalanceAccountId, setActiveBalanceAccountId] = useState('')

  const accountMap = useMemo(() => {
    const map = new Map<string, { name: string; currency: string; account_type: 'TRADING' | 'FUNDING' }>()
    fundingAccounts.forEach((acc) =>
      map.set(acc.id, { name: acc.name, currency: acc.currency, account_type: acc.account_type })
    )
    return map
  }, [fundingAccounts])

  const fundingAccountOptions = useMemo(() => 
    fundingAccounts
      .filter((acc) => acc.is_active)
      .map((acc) => ({
        balance_account_id: acc.id,
        name: acc.name,
        currency: acc.currency,
        account_type: acc.account_type,
      })),
    [fundingAccounts]
  )

  const totals = useMemo(() => {
    const deposited = initialData
      .filter((row) => row.type === 'deposit')
      .reduce((acc, row) => acc + Number(row.amount ?? 0), 0)
    const withdrawn = initialData
      .filter((row) => row.type === 'withdraw')
      .reduce((acc, row) => acc + Number(row.amount ?? 0), 0)
    return {
      deposited,
      withdrawn,
      net: deposited - withdrawn,
    }
  }, [initialData])

  const form = useForm<FundingFormInput>({
    resolver: zodResolver(fundingFormSchema),
    defaultValues: {
      type: 'deposit',
      amount: undefined,
      currency: fundingAccountOptions[0]?.currency ?? 'USD',
      method: methodOptions[0],
      note: undefined,
      transaction_time: defaultDateTimeValue(),
      balance_account_id: fundingAccountOptions[0]?.balance_account_id ?? '',
    },
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (fundingAccountOptions.length > 0 && !activeBalanceAccountId) {
      setActiveBalanceAccountId(fundingAccountOptions[0].balance_account_id)
    }
  }, [fundingAccountOptions, activeBalanceAccountId])

  const openNewDialog = useCallback(() => {
    const targetAccountId = activeBalanceAccountId || fundingAccountOptions[0]?.balance_account_id || ''
    const targetAccount = targetAccountId ? accountMap.get(targetAccountId) : undefined
    form.reset({
      type: 'deposit',
      amount: undefined,
      currency: targetAccount?.currency || 'USD',
      method: methodOptions[0],
      note: undefined,
      transaction_time: defaultDateTimeValue(),
      balance_account_id: targetAccountId,
    })
    setAmountInput('')
    setEditingRow(null)
    setDialogOpen(true)
  }, [activeBalanceAccountId, form, fundingAccountOptions, accountMap])

  useEffect(() => {
    const handleAdd = (e: Event) => {
      const custom = e as CustomEvent<string>
      if (custom.detail === 'trading:funding:new') {
        openNewDialog()
      }
    }
    window.addEventListener('xper:add', handleAdd)
    return () => window.removeEventListener('xper:add', handleAdd)
  }, [openNewDialog])

  const openEditDialog = (row: FundingRow) => {
    setEditingRow(row)
    form.reset({
      type: row.type,
      amount: row.amount ?? undefined,
      currency: row.currency,
      method: row.method,
      note: row.note ?? undefined,
      transaction_time: toInputDateTime(row.transaction_time),
      balance_account_id: row.balance_account_id ?? fundingAccountOptions[0]?.balance_account_id ?? '',
    })
    setAmountInput(row.amount !== null && row.amount !== undefined ? String(row.amount) : '')
    setDialogOpen(true)
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditingRow(null)
      setAmountInput('')
    }
  }

  const handleAmountChange = (raw: string, onChange: (value?: number) => void) => {
    setAmountInput(raw)
    const normalized = raw.replace(',', '.').trim()
    if (!normalized || normalized === '.' || normalized === '-') {
      onChange(undefined)
      return
    }
    const parsed = Number(normalized.startsWith('.') ? `0${normalized}` : normalized)
    onChange(Number.isFinite(parsed) ? parsed : undefined)
  }

  const handleSubmit = async (values: FundingFormInput) => {
    if (typeof values.amount !== 'number') {
      notify({ type: 'error', title: 'Thiếu số tiền', description: 'Nhập số tiền hợp lệ trước khi lưu giao dịch.' })
      return
    }
    if (!values.balance_account_id) {
      notify({ type: 'error', title: 'Chưa chọn balance account', description: 'Chọn balance account trước khi lưu.' })
      return
    }
    const txDate = new Date(values.transaction_time)
    const transaction_time = Number.isNaN(txDate.getTime()) ? new Date().toISOString() : txDate.toISOString()
    const payload = {
      ...values,
      amount: Number(values.amount),
      transaction_time,
      note: values.note?.trim() ? values.note.trim() : null,
    }

    try {
      if (editingRow) {
        await updateMutation.mutateAsync({ id: editingRow.id, values: payload })
        notify({
          type: 'success',
          title: 'Đã cập nhật giao dịch',
          description: 'Giao dịch đã được cập nhật.',
        })
      } else {
        await createMutation.mutateAsync(payload)
        notify({
          type: 'success',
          title: 'Đã tạo giao dịch',
          description: 'Giao dịch mới đã được thêm.',
        })
      }
      const targetAccountId = activeBalanceAccountId || fundingAccountOptions[0]?.balance_account_id || ''
      const targetAccount = targetAccountId ? accountMap.get(targetAccountId) : undefined
      form.reset({
        type: 'deposit',
        amount: undefined,
        currency: targetAccount?.currency || 'USD',
        method: methodOptions[0],
        note: undefined,
        transaction_time: defaultDateTimeValue(),
        balance_account_id: targetAccountId,
      })
      setAmountInput('')
      setDialogOpen(false)
      setEditingRow(null)
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Lưu giao dịch thất bại',
        description: err?.message ?? 'Failed to save transaction',
      })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      notify({
        type: 'success',
        title: 'Đã xóa giao dịch',
        description: 'Giao dịch funding đã được gỡ khỏi lịch sử.',
      })
      setDeleteTarget(null)
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Không xóa được giao dịch',
        description: err?.message ?? 'Failed to delete transaction',
      })
    }
  }

  const requestDelete = (row: FundingRow) => {
    setDeleteTarget(row)
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Funding history</h1>
          <p className="text-sm text-muted-foreground">Track deposits and withdrawals tied to your trading balance.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={openNewDialog} disabled={fundingAccountOptions.length === 0}>
              New transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[min(520px,calc(100vw-20px))] max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editingRow ? 'Edit transaction' : 'Add transaction'}</DialogTitle>
              <DialogDescription>
                {editingRow
                  ? 'Update a deposit or withdrawal entry.'
                  : 'Record a deposit or withdrawal against your trading account.'}
              </DialogDescription>
            </DialogHeader>
            {mounted ? (
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Type</FormLabel>
                          <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-1">
                            {(['deposit', 'withdraw'] as const).map((option) => (
                              <Button
                                key={option}
                                type="button"
                                variant={field.value === option ? 'default' : 'ghost'}
                                className={`flex-1 rounded-lg border border-transparent text-sm ${
                                  field.value === option ? 'bg-foreground text-white hover:bg-foreground' : 'bg-white'
                                }`}
                                onClick={() => field.onChange(option)}
                              >
                                {option === 'deposit' ? 'Deposit' : 'Withdraw'}
                              </Button>
                            ))}
                          </div>
                          <FormMessage>{form.formState.errors.type?.message}</FormMessage>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Amount</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              pattern="[0-9]*[.,]?[0-9]*"
                              inputMode="decimal"
                              className="h-12 rounded-xl text-base"
                              value={amountInput}
                              onChange={(e) => handleAmountChange(e.target.value, field.onChange)}
                              onBlur={(e) => setAmountInput(e.target.value.trim())}
                              placeholder="0.00"
                            />
                          </FormControl>
                          <FormMessage>{form.formState.errors.amount?.message}</FormMessage>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="balance_account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Balance account</FormLabel>
                        <Select
                          value={field.value ?? ''}
                          onValueChange={(val) => {
                            field.onChange(val)
                            setActiveBalanceAccountId(val)
                            const acc = accountMap.get(val)
                            if (acc?.currency) {
                              form.setValue('currency', acc.currency)
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn balance account" />
                          </SelectTrigger>
                          <SelectContent>
                            {fundingAccountOptions.map((acc) => (
                              <SelectItem key={acc.balance_account_id} value={acc.balance_account_id}>
                                {acc.name} ({acc.account_type === 'TRADING' ? 'Trading' : 'Funding'}) · {acc.currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage>{form.formState.errors.balance_account_id?.message}</FormMessage>
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Currency</FormLabel>
                          <FormControl>
                            <Input {...field} className="h-12 rounded-xl text-base" placeholder="USD" />
                          </FormControl>
                          <FormMessage>{form.formState.errors.currency?.message}</FormMessage>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Method</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-12 rounded-xl text-base">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                              {methodOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage>{form.formState.errors.method?.message}</FormMessage>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="transaction_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Transaction time</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            className="h-12 rounded-xl"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            step="60"
                          />
                        </FormControl>
                        <FormMessage>{form.formState.errors.transaction_time?.message}</FormMessage>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Note</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            className="rounded-xl text-base"
                            placeholder="Optional memo"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage>{form.formState.errors.note?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={() => handleDialogChange(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting || createMutation.isPending || updateMutation.isPending}>
                      {form.formState.isSubmitting || createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingRow ? 'Update transaction' : 'Save transaction'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>

      {fundingAccountOptions.length === 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-amber-800">Chưa có balance account</CardTitle>
            <CardDescription className="text-amber-700">
              Bạn cần có ít nhất một balance account đang hoạt động để ghi nhận funding. Hãy tạo hoặc kích hoạt account tại{' '}
              <Link to="/trading/accounts" className="font-semibold underline hover:text-amber-900">
                Balance Accounts
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Lỗi tải dữ liệu</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total deposited</CardDescription>
            <CardTitle>{currencyFormatter(totals.deposited, initialData[0]?.currency ?? 'USD')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">All time deposits</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total withdrawn</CardDescription>
            <CardTitle>{currencyFormatter(totals.withdrawn, initialData[0]?.currency ?? 'USD')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Cash moved out</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net deposits</CardDescription>
            <CardTitle>{currencyFormatter(totals.net, initialData[0]?.currency ?? 'USD')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Deposits minus withdrawals since inception</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>All funding transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No transactions yet
                    </TableCell>
                  </TableRow>
                ) : (
                  initialData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDateTime(row.transaction_time)}</TableCell>
                      <TableCell>
                        <span className={row.type === 'deposit' ? 'text-emerald-600' : 'text-red-600'}>
                          {row.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {currencyFormatter(row.amount, row.currency)}
                      </TableCell>
                      <TableCell>{row.method}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {accountMap.get(row.balance_account_id)?.name ?? row.balance_account_id}
                          </p>
                          {accountMap.get(row.balance_account_id)?.account_type ? (
                            <span className="text-xs text-muted-foreground">
                              {accountMap.get(row.balance_account_id)?.account_type === 'TRADING' ? 'Trading account' : 'Funding account'}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{row.note ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(row)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => requestDelete(row)}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this transaction? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
