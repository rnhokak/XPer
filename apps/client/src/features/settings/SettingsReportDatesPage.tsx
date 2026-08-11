import { type FormEvent, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useNotificationsStore } from '@/store/notifications'
import { reportTypes, type ReportType } from '@/lib/validation/report'
import {
  useReportRuns,
  useCreateReportRun,
  useUpdateReportRun,
  useDeleteReportRun,
} from '@/hooks/useSettingsData'
import { Loader2 } from 'lucide-react'

type ReportRun = {
  id: string
  user_id: string
  type: 'cashflow' | 'trading' | 'funding'
  report_date: string
  note: string | null
  created_at: string
  updated_at: string
}

const typeLabels: Record<ReportType, string> = {
  cashflow: 'Cashflow',
  trading: 'Trading',
  funding: 'Funding',
}

const todayValue = new Date().toISOString().slice(0, 10)

const sortRuns = (items: ReportRun[]) =>
  [...items].sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())

const toInputDate = (value?: string) => (value ? new Date(value).toISOString().slice(0, 10) : todayValue)

const baseAddState = () =>
  ({ type: reportTypes[0], reportDate: todayValue, note: '' } as {
    type: ReportType
    reportDate: string
    note: string
  })

const baseEditValues = () =>
  ({ id: '', type: reportTypes[0], reportDate: todayValue, note: '' } as {
    id: string
    type: ReportType
    reportDate: string
    note: string
  })

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-'

export default function SettingsReportDatesPage() {
  const notify = useNotificationsStore((state) => state.notify)
  const { data: initialRuns = [], isLoading } = useReportRuns()
  const createMutation = useCreateReportRun()
  const updateMutation = useUpdateReportRun()
  const deleteMutation = useDeleteReportRun()
  
  const [runs, setRuns] = useState<ReportRun[]>(() => sortRuns(initialRuns ?? []))
  const [addState, setAddState] = useState(baseAddState())
  const [editRun, setEditRun] = useState<ReportRun | null>(null)
  const [editValues, setEditValues] = useState(baseEditValues())
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useMemo(() => {
    if (initialRuns) {
      setRuns(sortRuns(initialRuns))
    }
  }, [initialRuns])

  const resetAddState = () => setAddState(baseAddState())

  const handleAddDialogChange = (open: boolean) => {
    setAddModalOpen(open)
    if (!open) {
      resetAddState()
    }
  }

  const handleEditDialogChange = (open: boolean) => {
    setEditModalOpen(open)
    if (!open) {
      setEditRun(null)
      setEditValues(baseEditValues())
    }
  }

  const openAddModal = () => {
    resetAddState()
    handleAddDialogChange(true)
  }

  const openEdit = (run: ReportRun) => {
    setEditRun(run)
    setEditValues({
      id: run.id,
      type: run.type,
      reportDate: toInputDate(run.report_date),
      note: run.note ?? '',
    })
    handleEditDialogChange(true)
  }

  const cancelEdit = () => {
    handleEditDialogChange(false)
  }

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      const result = await createMutation.mutateAsync({
        type: addState.type,
        report_date: addState.reportDate,
        note: addState.note.trim() || null,
      })

      setRuns((prev) => sortRuns([result, ...prev]))
      handleAddDialogChange(false)
      notify({
        type: 'success',
        title: 'Đã thêm ngày báo cáo',
        description: `Loại ${typeLabels[addState.type]} · ${formatDate(addState.reportDate)}`,
      })
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Không thể lưu ngày báo cáo',
        description: err?.message ?? 'Có lỗi xảy ra',
      })
    }
  }

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editRun) return

    try {
      const result = await updateMutation.mutateAsync({
        id: editValues.id,
        values: {
          type: editValues.type,
          report_date: editValues.reportDate,
          note: editValues.note.trim() || null,
        },
      })

      setRuns((prev) => sortRuns(prev.map((run) => (run.id === result.id ? result : run))))
      notify({
        type: 'success',
        title: 'Cập nhật thành công',
        description: `Loại ${typeLabels[result.type]} · ${formatDate(result.report_date)}`,
      })
      handleEditDialogChange(false)
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Không thể lưu thay đổi',
        description: err?.message ?? 'Có lỗi xảy ra',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa ngày báo cáo này sẽ không thể hoàn tác. Tiếp tục?')) {
      return
    }
    setDeletingId(id)

    try {
      await deleteMutation.mutateAsync(id)
      setRuns((prev) => sortRuns(prev.filter((run) => run.id !== id)))
      setDeletingId(null)
      if (editRun?.id === id) {
        cancelEdit()
      }
      notify({
        type: 'success',
        title: 'Đã xóa ngày báo cáo',
      })
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Không thể xóa',
        description: err?.message ?? 'Có lỗi xảy ra',
      })
    } finally {
      setDeletingId(null)
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
    <>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Bảng ngày báo cáo</h1>
          <p className="text-sm text-muted-foreground">
            Ghi lại ngày bắt đầu báo cáo mới nhất cho cashflow và trading.
          </p>
        </div>

        <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="flex items-center justify-between gap-4">
            <CardTitle>Quản lý ngày báo cáo</CardTitle>
            <Button variant="outline" onClick={openAddModal}>
              Thêm ngày báo cáo
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Ngày bắt đầu</th>
                    <th className="px-4 py-3">Ghi chú</th>
                    <th className="px-4 py-3">Ghi nhận</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Chưa có ngày báo cáo nào.
                      </td>
                    </tr>
                  ) : (
                    runs.map((run) => (
                      <tr key={run.id} className="border-t border-slate-100 bg-white/80">
                        <td className="px-4 py-3 text-foreground font-semibold">{typeLabels[run.type]}</td>
                        <td className="px-4 py-3">{formatDate(run.report_date)}</td>
                        <td className="px-4 py-3">{run.note ?? '-'}</td>
                        <td className="px-4 py-3">{formatDate(run.created_at ?? run.report_date)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(run)}>
                              Sửa
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(run.id)}
                              disabled={deletingId === run.id}
                            >
                              {deletingId === run.id ? 'Đang xóa' : 'Xóa'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addModalOpen} onOpenChange={handleAddDialogChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Thêm ngày báo cáo</DialogTitle>
            <DialogDescription>Chọn loại báo cáo và ngày bắt đầu để ghi nhận.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAdd}>
            <div>
              <Label htmlFor="type">Loại</Label>
              <Select
                value={addState.type}
                onValueChange={(value) => setAddState((prev) => ({ ...prev, type: value as ReportType }))}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="report-date">Ngày báo cáo</Label>
              <Input
                id="report-date"
                type="date"
                value={addState.reportDate}
                onChange={(e) => setAddState((prev) => ({ ...prev, reportDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="note">Ghi chú (tuỳ chọn)</Label>
              <Textarea
                id="note"
                value={addState.note}
                onChange={(e) => setAddState((prev) => ({ ...prev, note: e.target.value }))}
                rows={1}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => handleAddDialogChange(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang lưu...' : 'Thêm mới'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={handleEditDialogChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa ngày báo cáo</DialogTitle>
            <DialogDescription>Điều chỉnh loại, ngày bắt đầu hoặc ghi chú hiện tại.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdate}>
            <div>
              <Label htmlFor="edit-type">Loại</Label>
              <Select
                value={editValues.type}
                onValueChange={(value) => setEditValues((prev) => ({ ...prev, type: value as ReportType }))}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-date">Ngày báo cáo</Label>
              <Input
                id="edit-date"
                type="date"
                value={editValues.reportDate}
                onChange={(e) => setEditValues((prev) => ({ ...prev, reportDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-note">Ghi chú</Label>
              <Textarea
                id="edit-note"
                value={editValues.note}
                onChange={(e) => setEditValues((prev) => ({ ...prev, note: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={cancelEdit}>
                Hủy
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
