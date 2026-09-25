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
import {
  Clock,
  LayoutGrid,
  LayoutList,
  Loader2,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TradingOrderImportDialog } from './components/TradingOrderImportDialog'
import { TradingWinLossChart } from './components/TradingWinLossChart'

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
  const [viewLayout, setViewLayout] = useState<'cards' | 'table'>('cards')

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

  useEffect(() => {
    const handleAdd = (e: Event) => {
      const custom = e as CustomEvent<string>
      if (custom.detail === 'trading:orders:new') {
        openNewDialog()
      }
    }
    window.addEventListener('xper:add', handleAdd)
    return () => window.removeEventListener('xper:add', handleAdd)
  }, [openNewDialog])

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
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden w-full">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Orders</h1>
            <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Quản lý và theo dõi các lệnh giao dịch Forex, Crypto, Stocks
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLedgerSync}
            disabled={syncingLedger || syncLedgerMutation.isPending}
            className="h-9 px-2.5 sm:px-3 text-xs flex items-center gap-1.5 rounded-xl"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (syncingLedger || syncLedgerMutation.isPending) && "animate-spin")} />
            <span className="hidden sm:inline">Sync Ledger</span>
            <span className="sm:hidden">Sync</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
            disabled={tradingAccountOptions.length === 0}
            className="h-9 px-2.5 sm:px-3 text-xs flex items-center gap-1.5 rounded-xl"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">Import</span>
          </Button>

          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={openNewDialog}
                disabled={tradingAccountOptions.length === 0}
                className="h-9 px-3 text-xs font-semibold flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Thêm lệnh</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[min(600px,calc(100vw-24px))] max-h-[85vh] p-4 sm:p-6 overflow-y-auto rounded-2xl">
              <DialogHeader>
                <DialogTitle>{editingOrder ? 'Sửa lệnh giao dịch' : 'Thêm lệnh giao dịch mới'}</DialogTitle>
                <DialogDescription className="text-xs">
                  {editingOrder ? 'Cập nhật thông tin chi tiết của lệnh.' : 'Nhập thông tin lệnh giao dịch để theo dõi.'}
                </DialogDescription>
              </DialogHeader>
              {mounted ? (
                <Form {...form}>
                  <form className="space-y-3.5" onSubmit={form.handleSubmit(handleSubmit)}>
                    <div className="grid gap-3 grid-cols-2">
                      <FormField
                        control={form.control}
                        name="symbol"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Symbol</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="VD: EURUSD, XAUUSD" className="h-9 text-sm" />
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
                            <FormLabel className="text-xs">Loại lệnh (Side)</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Chọn side" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="buy">BUY (Mua)</SelectItem>
                                <SelectItem value="sell">SELL (Bán)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage>{form.formState.errors.side?.message}</FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="entry_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Entry Price</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.00001" {...field} onChange={(e) => field.onChange(Number(e.target.value))} className="h-9 text-sm font-mono" />
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
                            <FormLabel className="text-xs">Khối lượng (Lots)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(Number(e.target.value))} className="h-9 text-sm font-mono" />
                            </FormControl>
                            <FormMessage>{form.formState.errors.volume?.message}</FormMessage>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="balance_account_id"
                        render={({ field }) => (
                          <FormItem className="col-span-2 sm:col-span-1">
                            <FormLabel className="text-xs">Tài khoản</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Chọn TK" />
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

                    <div className="grid gap-3 grid-cols-2">
                      <FormField
                        control={form.control}
                        name="sl_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Stop Loss (SL)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.00001" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} className="h-9 text-sm font-mono" />
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
                            <FormLabel className="text-xs">Take Profit (TP)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.00001" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} className="h-9 text-sm font-mono" />
                            </FormControl>
                            <FormMessage>{form.formState.errors.tp_price?.message}</FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-3 grid-cols-2">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Trạng thái</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Chọn status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open (Đang mở)</SelectItem>
                                <SelectItem value="closed">Closed (Đã đóng)</SelectItem>
                                <SelectItem value="cancelled">Cancelled (Đã hủy)</SelectItem>
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
                            <FormLabel className="text-xs">Thời gian mở</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} className="h-9 text-xs sm:text-sm font-mono" />
                            </FormControl>
                            <FormMessage>{form.formState.errors.open_time?.message}</FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>

                    {form.watch('status') === 'closed' && (
                      <>
                        <div className="grid gap-3 grid-cols-2">
                          <FormField
                            control={form.control}
                            name="close_time"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Thời gian đóng</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" {...field} value={field.value ?? ''} className="h-9 text-xs sm:text-sm font-mono" />
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
                                <FormLabel className="text-xs">Close Price</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.00001" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} className="h-9 text-sm font-mono" />
                                </FormControl>
                                <FormMessage>{form.formState.errors.close_price?.message}</FormMessage>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid gap-3 grid-cols-2">
                          <FormField
                            control={form.control}
                            name="pnl_amount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">P&L Amount ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} className="h-9 text-sm font-mono" />
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
                                <FormLabel className="text-xs">Commission ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} className="h-9 text-sm font-mono" />
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
                          <FormLabel className="text-xs">Ghi chú (Tùy chọn)</FormLabel>
                          <FormControl>
                            <Textarea rows={2} {...field} value={field.value ?? ''} placeholder="Lý do vào lệnh, setup..." className="text-sm" />
                          </FormControl>
                          <FormMessage>{form.formState.errors.note?.message}</FormMessage>
                        </FormItem>
                      )}
                    />

                    <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
                      <Button type="button" variant="outline" className="w-full sm:w-auto h-9 text-xs" onClick={() => handleDialogChange(false)}>
                        Hủy
                      </Button>
                      <Button type="submit" className="w-full sm:w-auto h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={form.formState.isSubmitting || createMutation.isPending || updateMutation.isPending}>
                        {form.formState.isSubmitting || createMutation.isPending || updateMutation.isPending ? 'Đang lưu...' : editingOrder ? 'Cập nhật lệnh' : 'Tạo lệnh'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Account Selector if multiple exist */}
      {tradingAccountOptions.length > 1 && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-2.5 py-1.5 text-xs max-w-sm">
          <Wallet className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-500 font-medium">Tài khoản:</span>
          <Select value={activeBalanceAccountId} onValueChange={setActiveBalanceAccountId}>
            <SelectTrigger className="h-7 text-xs border-0 bg-white shadow-xs font-semibold px-2 py-0">
              <SelectValue placeholder="Chọn tài khoản" />
            </SelectTrigger>
            <SelectContent>
              {tradingAccountOptions.map((acc) => (
                <SelectItem key={acc.balance_account_id} value={acc.balance_account_id}>
                  {acc.name} ({acc.currency})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Lỗi tải dữ liệu</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* 4 Performance Metric Cards: 2x2 on Mobile, 4-col on Desktop */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        <Card className="p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Win Rate</span>
            <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-600">
              <Percent className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono text-slate-900">{metrics.winRate}%</div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate mt-0.5">{metrics.closedCount} lệnh đã đóng</p>
        </Card>

        <Card className="p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Net P&L</span>
            <span className={cn("p-1 rounded-md", metrics.totalPnl >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
              {metrics.totalPnl >= 0 ? <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            </span>
          </div>
          <div className={cn("text-lg sm:text-2xl font-bold font-mono truncate", metrics.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {metrics.totalPnl >= 0 ? '+' : ''}{formatNumber(metrics.totalPnl)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate mt-0.5">Sau Commission & Swap</p>
        </Card>

        <Card className="p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Gross P&L</span>
            <span className="p-1 rounded-md bg-blue-500/10 text-blue-600">
              <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono text-slate-900 truncate">
            {formatNumber(metrics.grossPnl)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate mt-0.5">Lãi/lỗ gộp ban đầu</p>
        </Card>

        <Card className="p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Phí sàn</span>
            <span className="p-1 rounded-md bg-rose-500/10 text-rose-600">
              <Percent className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono text-rose-600 truncate">
            {formatNumber(metrics.totalCommission)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate mt-0.5">Commission + Swap</p>
        </Card>
      </div>

      {/* Win/Loss Chart */}
      <TradingWinLossChart
        orders={initialOrders.filter((order) =>
          filters.symbol ? order.symbol.toLowerCase().includes(filters.symbol.toLowerCase()) : true
        )}
        currency={tradingAccountOptions[0]?.currency ?? 'USD'}
      />

      {/* Orders List Container */}
      <Card className="rounded-2xl border-slate-200/90 shadow-sm overflow-hidden w-full">
        <CardHeader className="p-3.5 sm:p-6 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base sm:text-lg font-semibold">Orders</CardTitle>
                  <Badge variant="outline" className="text-xs font-mono">
                    {filteredOrders.length}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  {filters.symbol || filters.status !== 'all' ? 'Đang lọc kết quả' : 'Tất cả các lệnh giao dịch'}
                </CardDescription>
              </div>

              {/* View Layout Toggle — Desktop only (table may overflow on mobile) */}
              <div className="hidden sm:flex items-center rounded-lg border bg-slate-100/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewLayout('cards')}
                  className={cn(
                    "p-1.5 rounded-md text-xs transition-all",
                    viewLayout === 'cards' ? "bg-white text-emerald-700 shadow-xs font-semibold" : "text-slate-500"
                  )}
                  title="Dạng thẻ"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout('table')}
                  className={cn(
                    "p-1.5 rounded-md text-xs transition-all",
                    viewLayout === 'table' ? "bg-white text-emerald-700 shadow-xs font-semibold" : "text-slate-500"
                  )}
                  title="Dạng bảng"
                >
                  <LayoutList className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Lọc theo symbol..."
                  value={filters.symbol}
                  onChange={(e) => setFilters((prev) => ({ ...prev, symbol: e.target.value }))}
                  className="pl-8 pr-7 h-9 text-xs sm:text-sm"
                />
                {filters.symbol && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, symbol: '' }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <Select value={filters.status} onValueChange={(val) => setFilters((prev) => ({ ...prev, status: val as StatusFilter }))}>
                <SelectTrigger className="w-28 sm:w-32 h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả ({initialOrders.length})</SelectItem>
                  <SelectItem value="open">Open ({initialOrders.filter(o => o.status === 'open').length})</SelectItem>
                  <SelectItem value="closed">Closed ({initialOrders.filter(o => o.status === 'closed').length})</SelectItem>
                  <SelectItem value="cancelled">Cancelled ({initialOrders.filter(o => o.status === 'cancelled').length})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-6 pt-0">
          {/* Mobile Card View — always shown on small screens regardless of viewLayout */}
          <div className={cn("space-y-2.5", "block sm:hidden")}>
            {paginatedOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Không tìm thấy lệnh giao dịch nào phù hợp.
              </div>
            ) : (
              paginatedOrders.map((order) => {
                const commission = getOrderCommission(order)
                const netPnl = getOrderNetPnl(order)
                const isProfitable = netPnl >= 0

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs transition-all active:scale-[0.99] space-y-2.5"
                  >
                    {/* Top Row: Symbol + Side Badge + Ticket + Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
                            order.side === 'buy'
                              ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                          )}
                        >
                          {order.side === 'buy' ? 'BUY ↗' : 'SELL ↘'}
                        </span>
                        <span className="font-bold text-base text-slate-900 tracking-tight">
                          {order.symbol}
                        </span>
                        {order.ticket && (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            #{order.ticket}
                          </span>
                        )}
                        {order.is_imported && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-200 text-blue-700 bg-blue-50">
                            Imported
                          </Badge>
                        )}
                      </div>

                      <Badge
                        variant={
                          order.status === 'open'
                            ? 'default'
                            : order.status === 'closed'
                            ? 'secondary'
                            : 'outline'
                        }
                        className={cn(
                          "text-[11px] capitalize",
                          order.status === 'open' && "bg-blue-600 hover:bg-blue-700 text-white"
                        )}
                      >
                        {order.status}
                      </Badge>
                    </div>

                    {/* Main P&L & Volume Box */}
                    <div className="flex items-baseline justify-between rounded-xl bg-slate-50/90 px-3 py-2 border border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                          Net P&L
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={cn(
                              "text-xl font-extrabold font-mono tracking-tight",
                              isProfitable ? "text-emerald-600" : "text-rose-600"
                            )}
                          >
                            {isProfitable ? '+' : ''}
                            {formatNumber(netPnl, 2)}
                          </span>
                          {order.pnl_percent !== null && order.pnl_percent !== undefined && (
                            <span className="text-xs font-medium text-muted-foreground font-mono">
                              ({order.pnl_percent > 0 ? '+' : ''}
                              {formatNumber(order.pnl_percent, 2)}%)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                          Khối lượng
                        </span>
                        <span className="text-sm font-bold font-mono text-slate-800">
                          {formatNumber(order.volume, 2)} lot
                        </span>
                      </div>
                    </div>

                    {/* Micro-grid of Prices */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                      <div className="space-y-0.5">
                        <div className="text-muted-foreground text-[11px]">
                          Entry: <span className="font-mono font-semibold text-slate-800">{formatNumber(order.entry_price, 5)}</span>
                        </div>
                        {order.sl_price && (
                          <div className="text-[11px] text-rose-500 font-mono">
                            SL: {formatNumber(order.sl_price, 5)}
                          </div>
                        )}
                      </div>

                      <div className="space-y-0.5 text-right">
                        <div className="text-muted-foreground text-[11px]">
                          Close: <span className="font-mono font-semibold text-slate-800">{order.close_price ? formatNumber(order.close_price, 5) : '—'}</span>
                        </div>
                        {order.tp_price && (
                          <div className="text-[11px] text-emerald-600 font-mono">
                            TP: {formatNumber(order.tp_price, 5)}
                          </div>
                        )}
                      </div>
                    </div>

                    {commission !== 0 && (
                      <div className="text-[11px] text-muted-foreground flex justify-between border-t border-slate-100 pt-1">
                        <span>Phí / Swap:</span>
                        <span className="font-mono text-rose-600">
                          {formatNumber(commission, 2)}
                        </span>
                      </div>
                    )}

                    {/* Footer: Date & Touch Action Buttons */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{formatDateTime(order.open_time)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(order)}
                          disabled={order.is_imported}
                          className="h-8 px-2.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 gap-1 rounded-lg"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Sửa</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(order)}
                          disabled={order.is_imported}
                          className={cn(
                            "h-8 px-2.5 text-xs gap-1 rounded-lg",
                            order.is_imported ? "text-muted-foreground" : "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xóa</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop Table View (and desktop-initiated table view on ≥sm) */}
          <div className={cn("overflow-x-auto", viewLayout === 'cards' ? "hidden sm:block" : "hidden sm:block")}>
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Symbol</TableHead>
                  <TableHead className="whitespace-nowrap w-16">Side</TableHead>
                  <TableHead className="whitespace-nowrap w-20">Volume</TableHead>
                  <TableHead className="whitespace-nowrap w-28">Entry</TableHead>
                  <TableHead className="whitespace-nowrap w-28">Close</TableHead>
                  <TableHead className="whitespace-nowrap w-24">P&L</TableHead>
                  <TableHead className="whitespace-nowrap w-20">Status</TableHead>
                  <TableHead className="whitespace-nowrap w-36">Open Time</TableHead>
                  <TableHead className="text-right w-28">Actions</TableHead>
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
                      <TableCell className="whitespace-nowrap font-mono text-xs">{formatNumber(order.volume, 2)}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{formatNumber(order.entry_price, 5)}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{formatNumber(order.close_price, 5)}</TableCell>
                      <TableCell className={cn("whitespace-nowrap font-mono text-xs font-semibold", getOrderNetPnl(order) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {getOrderNetPnl(order) >= 0 ? '+' : ''}{formatNumber(getOrderNetPnl(order))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'open' ? 'default' : order.status === 'closed' ? 'secondary' : 'outline'} className="text-[11px]">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(order.open_time)}</TableCell>
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
              <p className="text-xs sm:text-sm text-muted-foreground">
                Trang {currentPage} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="w-[min(480px,calc(100vw-24px))] p-4 sm:p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle>Xác nhận xóa lệnh</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Bạn có chắc chắn muốn xóa lệnh {deleteTarget.symbol} {deleteTarget.ticket ? `#${deleteTarget.ticket}` : ''}? Thao tác này không thể hoàn tác.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
              <Button variant="outline" className="w-full sm:w-auto h-9 text-xs" onClick={() => setDeleteTarget(null)}>
                Hủy
              </Button>
              <Button variant="destructive" className="w-full sm:w-auto h-9 text-xs" onClick={confirmDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa lệnh'}
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
