import { useState, useRef, useMemo, ChangeEvent } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useNotificationsStore } from '@/store/notifications'
import { useImportOrders } from '@/hooks/useTradingData'
import {
  parseTradingOrdersCsv,
  type ParseOrderCsvResult,
} from '../utils/tradingCsvParser'
import { FileUp, AlertCircle, CheckCircle2, Loader2, RefreshCw, FileSpreadsheet } from 'lucide-react'

interface TradingOrderImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tradingAccounts: Array<{ balance_account_id: string; name: string; currency: string }>
  defaultBalanceAccountId?: string
}

export function TradingOrderImportDialog({
  open,
  onOpenChange,
  tradingAccounts,
  defaultBalanceAccountId = '',
}: TradingOrderImportDialogProps) {
  const notify = useNotificationsStore((state) => state.notify)
  const importMutation = useImportOrders()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedAccountId, setSelectedAccountId] = useState(defaultBalanceAccountId)
  const [file, setFile] = useState<File | null>(null)
  const [fileText, setFileText] = useState<string>('')
  const [parseResult, setParseResult] = useState<ParseOrderCsvResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [showErrorList, setShowErrorList] = useState(false)

  // Ensure selectedAccountId is initialized
  const effectiveAccountId = useMemo(() => {
    if (selectedAccountId && tradingAccounts.some((a) => a.balance_account_id === selectedAccountId)) {
      return selectedAccountId
    }
    return tradingAccounts[0]?.balance_account_id || ''
  }, [selectedAccountId, tradingAccounts])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setIsParsing(true)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setFileText(text)
      const res = parseTradingOrdersCsv(text, effectiveAccountId)
      setParseResult(res)
      setIsParsing(false)
    }
    reader.onerror = () => {
      notify({
        type: 'error',
        title: 'Lỗi đọc file',
        description: 'Không thể đọc nội dung file đã chọn.',
      })
      setIsParsing(false)
    }
    reader.readAsText(selectedFile)
  }

  const handleAccountChange = (newAccountId: string) => {
    setSelectedAccountId(newAccountId)
    if (fileText) {
      const res = parseTradingOrdersCsv(fileText, newAccountId)
      setParseResult(res)
    }
  }

  const handleReset = () => {
    setFile(null)
    setFileText('')
    setParseResult(null)
    setShowErrorList(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    if (isImporting) return
    handleReset()
    onOpenChange(false)
  }

  const handleImport = async () => {
    if (!parseResult || parseResult.validOrders.length === 0) return
    if (!effectiveAccountId) {
      notify({
        type: 'error',
        title: 'Chưa chọn tài khoản giao dịch',
        description: 'Vui lòng chọn tài khoản giao dịch cho các lệnh cần import.',
      })
      return
    }

    setIsImporting(true)
    const allOrders = parseResult.validOrders.map((order) => ({
      ...order,
      balance_account_id: effectiveAccountId,
    }))

    // API limit is 500 rows per request. Batch if needed.
    const BATCH_SIZE = 500
    let totalImported = 0
    let totalSkipped = 0

    try {
      for (let i = 0; i < allOrders.length; i += BATCH_SIZE) {
        const batch = allOrders.slice(i, i + BATCH_SIZE)
        const res = await importMutation.mutateAsync(batch)
        totalImported += res.count
        totalSkipped += res.skipped
      }

      notify({
        type: 'success',
        title: 'Import thành công',
        description: `Đã nhập ${totalImported} lệnh giao dịch (${totalSkipped} lệnh trùng Ticket đã được bỏ qua).`,
      })

      handleClose()
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Import thất bại',
        description: err?.response?.data?.error || err?.message || 'Có lỗi xảy ra khi nhập lệnh giao dịch.',
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-3xl sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Fixed Header */}
        <div className="p-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileUp className="h-5 w-5 text-primary" />
              Import Trading Orders từ CSV
            </DialogTitle>
            <DialogDescription>
              Tải lên file CSV chứa danh sách lệnh giao dịch để import vào hệ thống.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Account Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tài khoản giao dịch</label>
            <Select value={effectiveAccountId} onValueChange={handleAccountChange} disabled={isImporting}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn tài khoản" />
              </SelectTrigger>
              <SelectContent>
                {tradingAccounts.map((acc) => (
                  <SelectItem key={acc.balance_account_id} value={acc.balance_account_id}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.txt,.tsv"
            className="hidden"
            disabled={isImporting}
          />

          {/* Upload Area: Large if no file, Compact if file selected */}
          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-colors"
            >
              <FileUp className="mx-auto h-9 w-9 text-muted-foreground mb-2" />
              <div className="font-medium text-sm">
                Bấm để chọn file CSV hoặc kéo thả file vào đây
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Hỗ trợ định dạng .csv, .tsv chứa cột ticket, symbol, type, lots, open/close price, profit...
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-sm text-foreground">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Chọn file khác
              </Button>
            </div>
          )}

          {/* Parsing Spinner */}
          {isParsing && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang phân tích cấu trúc dữ liệu file CSV...
            </div>
          )}

          {/* Results Summary & Preview */}
          {parseResult && !isParsing && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg border text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>
                    Tìm thấy <strong className="text-emerald-600 font-semibold">{parseResult.validOrders.length}</strong> lệnh hợp lệ
                  </span>
                </div>
                {parseResult.errors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span>
                      <strong className="text-amber-600">{parseResult.errors.length}</strong> dòng không hợp lệ
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground underline"
                      onClick={() => setShowErrorList(!showErrorList)}
                    >
                      {showErrorList ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Error list dropdown if any */}
              {showErrorList && parseResult.errors.length > 0 && (
                <div className="max-h-36 overflow-y-auto p-2.5 bg-destructive/10 border border-destructive/20 rounded text-xs space-y-1 text-destructive">
                  {parseResult.errors.map((err, i) => (
                    <div key={i}>
                      • Dòng {err.rowNumber}: {err.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview Table of first 5 valid orders */}
              {parseResult.validOrders.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Xem trước dữ liệu ({Math.min(5, parseResult.validOrders.length)}/{parseResult.validOrders.length} lệnh):
                  </div>
                  <div className="rounded-md border overflow-x-auto text-xs">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="py-2 whitespace-nowrap">Ticket</TableHead>
                          <TableHead className="py-2 whitespace-nowrap">Symbol</TableHead>
                          <TableHead className="py-2 whitespace-nowrap">Side</TableHead>
                          <TableHead className="py-2 whitespace-nowrap">Lots</TableHead>
                          <TableHead className="py-2 whitespace-nowrap">Entry Price</TableHead>
                          <TableHead className="py-2 whitespace-nowrap">Close Price</TableHead>
                          <TableHead className="py-2 whitespace-nowrap">P&L ($)</TableHead>
                          <TableHead className="py-2 whitespace-nowrap">Status</TableHead>
                          <TableHead className="py-2 whitespace-nowrap">Open Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parseResult.validOrders.slice(0, 5).map((ord, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="py-2 font-mono whitespace-nowrap">{ord.ticket || '—'}</TableCell>
                            <TableCell className="py-2 font-medium whitespace-nowrap">{ord.symbol}</TableCell>
                            <TableCell className="py-2 whitespace-nowrap">
                              <Badge variant={ord.side === 'buy' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 uppercase">
                                {ord.side}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 whitespace-nowrap">{ord.volume}</TableCell>
                            <TableCell className="py-2 font-mono whitespace-nowrap">{ord.entry_price}</TableCell>
                            <TableCell className="py-2 font-mono whitespace-nowrap">{ord.close_price ?? '—'}</TableCell>
                            <TableCell
                              className={`py-2 font-mono whitespace-nowrap font-medium ${
                                ord.pnl_amount === null || ord.pnl_amount === undefined
                                  ? ''
                                  : ord.pnl_amount >= 0
                                  ? 'text-emerald-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {ord.pnl_amount !== null && ord.pnl_amount !== undefined
                                ? (ord.pnl_amount >= 0 ? '+' : '') + ord.pnl_amount
                                : '—'}
                            </TableCell>
                            <TableCell className="py-2 whitespace-nowrap">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {ord.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-muted-foreground whitespace-nowrap">
                              {ord.open_time ? new Date(ord.open_time).toLocaleString() : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Footer pinned at the bottom */}
        <div className="p-4 px-6 border-t bg-muted/10 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {parseResult?.validOrders.length ? (
              <span>
                Đã sẵn sàng nhập <strong>{parseResult.validOrders.length}</strong> lệnh
              </span>
            ) : (
              <span>Chưa có dữ liệu lệnh</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isImporting}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={!parseResult || parseResult.validOrders.length === 0 || !effectiveAccountId || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang nhập dữ liệu...
                </>
              ) : (
                `Nhập ${parseResult?.validOrders.length ? `${parseResult.validOrders.length} lệnh` : ''}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
