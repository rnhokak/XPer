import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { orderFormSchema, type OrderFormValues } from '@/lib/validation/trading'
import { useNotificationsStore } from '@/store/notifications'
import { useOrders, useCreateOrder, useUpdateOrder, useDeleteOrder, useSyncOrdersLedger } from '@/hooks/useTradingData'
import { useBalanceAccounts } from '@/hooks/useTradingData'
import { Loader2, Percent, Upload } from 'lucide-react'
import { TradingOrderImportDialog } from './components/TradingOrderImportDialog'

type OrderRow = {
  id: string
  user_id: string
  balance_account_id: string
  ticket?: string | null
  symbol: string
  side: 'buy' | 'sell'
  entry_price: number
  sl_price?: number | null
  tp_price?: number | null
  volume: number
  leverage?: number | null
  original_position_size?: number | null
  commission_usd?: number | null
  swap_usd?: number | null
  equity_usd?: number | null
  margin_level?: number | null
  close_reason?: string | null
  status: 'open' | 'closed' | 'cancelled'
  open_time: string
  close_time?: string | null
  close_price?: number | null
  pnl_amount?: number | null
  pnl_percent?: number | null
  note?: string | null
  is_imported?: boolean
  created_at: string
  updated_at: string
}

type StatusFilter = 'all' | 'open' | 'closed' | 'cancelled'

const defaultDateTimeValue = () => new Date().toISOString().slice(0, 16)
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—')
const toInputDateTime = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 16) : '')
const PAGE_SIZE = 50

const formatNumber = (value?: number | null, fractionDigits = 2) =>
  value === null || value === undefined
    ? '—'
    : Number(value).toLocaleString(undefined, { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits })

const getOrderCommission = (order: OrderRow) => Number(order.commission_usd ?? 0) + Number(order.swap_usd ?? 0)
const getOrderNetPnl = (order: OrderRow) => Number(order.pnl_amount ?? 0) + getOrderCommission(order)

const defaultOrderValues = (balanceAccountId?: string): OrderFormValues => ({
  ticket: '',
  symbol: '',
  side: 'buy',
  entry_price: 0,
  sl_price: undefined,
  tp_price: undefined,
  volume: 0,
  leverage: undefined,
  original_position_size: undefined,
  commission_usd: undefined,
  swap_usd: undefined,
  equity_usd: undefined,
  margin_level: undefined,
  close_reason: undefined,
  status: 'open',
  open_time: defaultDateTimeValue(),
  close_time: '',
  close_price: undefined,
  pnl_amount: undefined,
  pnl_percent: undefined,
  note: undefined,
  balance_account_id: balanceAccountId ?? '',
})

export default function TradingOrdersPage() {
  const notify = useNotificationsStore((state) => state.notify)
  const { data: initialOrders = [], isLoading, error } = useOrders()
  const { data: tradingAccounts = [] } = useBalanceAccounts()
  const createMutation = useCreateOrder()
  const updateMutation = useUpdateOrder()
  const deleteMutation = useDeleteOrder()
  const syncLedgerMutation = useSyncOrdersLedger()
  
  const [activeBalanceAccountId, setActiveBalanceAccountId] = useState('')
  const [mounted, setMounted] = useState(false)
  const [filters, setFilters] = useState<{ symbol: string; status: StatusFilter }>({ symbol: '', status: 'all' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<OrderRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrderRow | null>(null)
  const [page, setPage] = useState(1)
  const [syncingLedger, setSyncingLedger] = useState(false)

  const tradingAccountOptions = useMemo(() => 
    tradingAccounts
      .filter((acc) => acc.account_type === 'TRADING')
      .map((acc) => ({ balance_account_id: acc.id, name: acc.name, currency: acc.currency })),
    [tradingAccounts]
  )

  const filteredOrders = useMemo(() => {
    return initialOrders.filter((order) => {
      const matchesSymbol = filters.symbol
        ? order.symbol.toLowerCase().includes(filters.symbol.toLowerCase())
        : true
      const matchesStatus = filters.status === 'all' ? true : order.status === filters.status
      return matchesSymbol && matchesStatus
    })
  }, [filters, initialOrders])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const metrics = useMemo(() => {
    const closedOrders = filteredOrders.filter((o) => o.status === 'closed')
    const winCount = closedOrders.filter((o) => getOrderNetPnl(o) > 0).length
    const closedCount = closedOrders.length
    const winRate = closedCount === 0 ? 0 : Math.round((winCount / closedCount) * 100)
    const totalPnl = closedOrders.reduce((acc, o) => acc + getOrderNetPnl(o), 0)
    const totalCommission = closedOrders.reduce((acc, o) => acc + getOrderCommission(o), 0)
    const grossPnl = closedOrders.reduce((acc, o) => acc + Number(o.pnl_amount ?? 0), 0)

    return {
      winRate,
      closedCount,
      totalPnl,
      totalCommission,
      grossPnl,
    }
  }, [filteredOrders])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (tradingAccountOptions.length > 0 && !activeBalanceAccountId) {
      setActiveBalanceAccountId(tradingAccountOptions[0].balance_account_id)
    }
  }, [tradingAccountOptions, activeBalanceAccountId])

  useEffect(() => {
    setPage(1)
  }, [filters.symbol, filters.status, initialOrders.length])

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: defaultOrderValues(activeBalanceAccountId),
  })

  const handleLedgerSync = async () => {
    setSyncingLedger(true)
    try {
      await syncLedgerMutation.mutateAsync()
      notify({
        type: 'success',
        title: 'Đã sync ledger',
        description: 'Orders have been synced with ledger.',
      })
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Sync ledger thất bại',
        description: err?.message ?? 'Sync failed',
      })
    } finally {
      setSyncingLedger(false)
    }
  }

  const openNewDialog = useCallback(() => {
    if (!activeBalanceAccountId) {
      notify({
        type: 'error',
        title: 'Chưa chọn balance account',
        description: 'Chọn Trading balance account trước khi tạo order.',
      })
      return
    }
    setEditingOrder(null)
    form.reset({
      ...defaultOrderValues(activeBalanceAccountId),
      balance_account_id: activeBalanceAccountId ?? '',
    })
    setDialogOpen(true)
  }, [activeBalanceAccountId, form, notify])

  const openEditDialog = (order: OrderRow) => {
    setEditingOrder(order)
    form.reset({
      ticket: order.ticket ?? '',
      symbol: order.symbol,
      side: order.side,
      entry_price: order.entry_price,
      sl_price: order.sl_price ?? undefined,
      tp_price: order.tp_price ?? undefined,
      volume: order.volume,
      leverage: order.leverage ?? undefined,
      original_position_size: order.original_position_size ?? undefined,
      commission_usd: order.commission_usd ?? undefined,
      swap_usd: order.swap_usd ?? undefined,
      equity_usd: order.equity_usd ?? undefined,
      margin_level: order.margin_level ?? undefined,
      close_reason: order.close_reason ?? undefined,
      status: order.status,
      open_time: toInputDateTime(order.open_time),
      close_time: toInputDateTime(order.close_time),
      close_price: order.close_price ?? undefined,
      pnl_amount: order.pnl_amount ?? undefined,
      pnl_percent: order.pnl_percent ?? undefined,
      note: order.note ?? undefined,
      balance_account_id: order.balance_account_id ?? activeBalanceAccountId ?? '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (values: OrderFormValues) => {
    if (!values.balance_account_id) {
      notify({
        type: 'error',
        title: 'Chưa chọn balance account',
        description: 'Chọn balance account trước khi lưu order.',
      })
      return
    }

    const payload = {
      ...values,
      balance_account_id: values.balance_account_id,
      close_time: values.close_time ? new Date(values.close_time).toISOString() : null,
      open_time: new Date(values.open_time).toISOString(),
      note: values.note?.trim() ? values.note.trim() : null,
    }

    try {
      if (editingOrder) {
        await updateMutation.mutateAsync({ id: editingOrder.id, values: payload })
        notify({
          type: 'success',
          title: 'Đã cập nhật order',
          description: 'Order đã được cập nhật.',
        })
      } else {
        await createMutation.mutateAsync(payload)
        notify({
          type: 'success',
          title: 'Đã tạo order',
          description: 'Order mới đã được thêm.',
        })
      }
      form.reset({
        ...defaultOrderValues(activeBalanceAccountId),
        balance_account_id: activeBalanceAccountId ?? '',
      })
      setDialogOpen(false)
      setEditingOrder(null)
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Lưu order thất bại',
        description: err?.message ?? 'Failed to save order',
      })
    }
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditingOrder(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      notify({
        type: 'success',
        title: 'Đã xóa order',
        description: 'Order đã được gỡ khỏi danh sách.',
      })
      setDeleteTarget(null)
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Không xóa được order',
        description: err?.message ?? 'Failed to delete order',
      })
    }
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
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">Manage your trading orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleLedgerSync} disabled={syncingLedger || syncLedgerMutation.isPending}>
            {syncingLedger || syncLedgerMutation.isPending ? 'Syncing...' : 'Sync Ledger'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            disabled={tradingAccountOptions.length === 0}
            className="flex items-center gap-1.5"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button size="lg" onClick={openNewDialog} disabled={tradingAccountOptions.length === 0}>
                New order
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[min(600px,calc(100vw-20px))] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingOrder ? 'Edit order' : 'New order'}</DialogTitle>
                <DialogDescription>
                  {editingOrder ? 'Update order details.' : 'Create a new trading order.'}
                </DialogDescription>
              </DialogHeader>
              {mounted ? (
                <Form {...form}>
                  <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="symbol"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Symbol</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. EURUSD" />
                            </FormControl>
                            <FormMessage>{form.formState.errors.symbol?.message}</FormMessage>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="side"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Side</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select side" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="buy">Buy</SelectItem>
                                <SelectItem value="sell">Sell</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage>{form.formState.errors.side?.message}</FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="entry_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Entry Price</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.00001" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage>{form.formState.errors.entry_price?.message}</FormMessage>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="volume"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Volume (lots)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage>{form.formState.errors.volume?.message}</FormMessage>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="balance_account_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Trading Account</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                              <SelectContent>
                                {tradingAccountOptions.map((acc) => (
                                  <SelectItem key={acc.balance_account_id} value={acc.balance_account_id}>
                                    {acc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage>{form.formState.errors.balance_account_id?.message}</FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="sl_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stop Loss</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.00001" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                            </FormControl>
                            <FormMessage>{form.formState.errors.sl_price?.message}</FormMessage>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="tp_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Take Profit</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.00001" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                            </FormControl>
                            <FormMessage>{form.formState.errors.tp_price?.message}</FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage>{form.formState.errors.status?.message}</FormMessage>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="open_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Open Time</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                            <FormMessage>{form.formState.errors.open_time?.message}</FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>

                    {form.watch('status') === 'closed' && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="close_time"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Close Time</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage>{form.formState.errors.close_time?.message}</FormMessage>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="close_price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Close Price</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.00001" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                                </FormControl>
                                <FormMessage>{form.formState.errors.close_price?.message}</FormMessage>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="pnl_amount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>P&L Amount</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                                </FormControl>
                                <FormMessage>{form.formState.errors.pnl_amount?.message}</FormMessage>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="commission_usd"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Commission</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                                </FormControl>
                                <FormMessage>{form.formState.errors.commission_usd?.message}</FormMessage>
                              </FormItem>
                            )}
                          />
                        </div>
                      </>
                    )}

                    <FormField
                      control={form.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note</FormLabel>
                          <FormControl>
                            <Textarea rows={3} {...field} value={field.value ?? ''} />
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
                        {form.formState.isSubmitting || createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingOrder ? 'Update order' : 'Create order'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Lỗi tải dữ liệu</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              {metrics.winRate}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{metrics.closedCount} closed orders</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total P&L</CardDescription>
            <CardTitle className={metrics.totalPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {metrics.totalPnl >= 0 ? '+' : ''}{formatNumber(metrics.totalPnl)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Net P&L including commission</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross P&L</CardDescription>
            <CardTitle>{formatNumber(metrics.grossPnl)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Before commission & swap</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Commission</CardDescription>
            <CardTitle className="text-red-600">{formatNumber(metrics.totalCommission)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Commission + Swap</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Orders</CardTitle>
              <CardDescription>All your trading orders</CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Filter by symbol..."
                value={filters.symbol}
                onChange={(e) => setFilters((prev) => ({ ...prev, symbol: e.target.value }))}
                className="w-48"
              />
              <Select value={filters.status} onValueChange={(val) => setFilters((prev) => ({ ...prev, status: val as StatusFilter }))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Close</TableHead>
                  <TableHead>P&L</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Open Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span>{order.symbol}</span>
                            {order.is_imported && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                                Imported
                              </Badge>
                            )}
                          </div>
                          {order.ticket && (
                            <span className="text-[11px] text-muted-foreground font-mono">#{order.ticket}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.side === 'buy' ? 'default' : 'secondary'}>
                          {order.side === 'buy' ? 'Buy' : 'Sell'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatNumber(order.volume, 2)}</TableCell>
                      <TableCell>{formatNumber(order.entry_price, 5)}</TableCell>
                      <TableCell>{formatNumber(order.close_price, 5)}</TableCell>
                      <TableCell className={getOrderNetPnl(order) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {getOrderNetPnl(order) >= 0 ? '+' : ''}{formatNumber(getOrderNetPnl(order))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'open' ? 'default' : order.status === 'closed' ? 'secondary' : 'outline'}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDateTime(order.open_time)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(order)}
                            disabled={order.is_imported}
                            title={order.is_imported ? 'Lệnh đã import không thể chỉnh sửa' : 'Edit order'}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={order.is_imported ? 'text-muted-foreground' : 'text-red-600'}
                            onClick={() => setDeleteTarget(order)}
                            disabled={order.is_imported}
                            title={order.is_imported ? 'Lệnh đã import không thể xóa' : 'Delete order'}
                          >
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

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this order? This action cannot be undone.
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

      <TradingOrderImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        tradingAccounts={tradingAccountOptions}
        defaultBalanceAccountId={activeBalanceAccountId}
      />
    </div>
  )
}
