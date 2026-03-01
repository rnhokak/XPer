"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useNotificationsStore } from "@/store/notifications";
import { reportTypes, type ReportType } from "@/lib/validation/report";
import type { Database } from "@/lib/supabase/types";

const typeLabels: Record<ReportType, string> = {
  cashflow: "Cashflow",
  trading: "Trading",
  funding: "Funding",
};

type ReportRunRow = Database["public"]["Tables"]["report_runs"]["Row"];

type Props = {
  initialRuns: ReportRunRow[];
};

const todayValue = new Date().toISOString().slice(0, 10);

const sortRuns = (items: ReportRunRow[]) =>
  [...items].sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());

const toInputDate = (value?: string) => (value ? new Date(value).toISOString().slice(0, 10) : todayValue);

const baseAddState = () =>
  ({ type: reportTypes[0], reportDate: todayValue, note: "" } as {
    type: ReportType;
    reportDate: string;
    note: string;
  });
const baseEditValues = () =>
  ({ id: "", type: reportTypes[0], reportDate: todayValue, note: "" } as {
    id: string;
    type: ReportType;
    reportDate: string;
    note: string;
  });

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

export default function ReportDatesManager({ initialRuns }: Props) {
  const [runs, setRuns] = useState<ReportRunRow[]>(() => sortRuns(initialRuns));
  const [addState, setAddState] = useState(baseAddState());
  const [creating, setCreating] = useState(false);
  const [editRun, setEditRun] = useState<ReportRunRow | null>(null);
  const [editValues, setEditValues] = useState(baseEditValues());
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const notify = useNotificationsStore((state) => state.notify);

  const resetAddState = () => setAddState(baseAddState());
  const handleAddDialogChange = (open: boolean) => {
    setAddModalOpen(open);
    if (!open) {
      resetAddState();
    }
  };

  const closeAddModal = () => {
    handleAddDialogChange(false);
  };

  const handleEditDialogChange = (open: boolean) => {
    setEditModalOpen(open);
    if (!open) {
      setEditRun(null);
      setEditValues(baseEditValues());
    }
  };

  const closeEditModal = () => {
    handleEditDialogChange(false);
  };

  const openAddModal = () => {
    resetAddState();
    handleAddDialogChange(true);
  };

  const openEdit = (run: ReportRunRow) => {
    setEditRun(run);
    setEditValues({
      id: run.id,
      type: run.type,
      reportDate: toInputDate(run.report_date),
      note: run.note ?? "",
    });
    handleEditDialogChange(true);
  };

  const cancelEdit = () => {
    closeEditModal();
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);

    try {
      const response = await fetch("/api/report-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: addState.type,
          report_date: addState.reportDate,
          note: addState.note.trim() || null,
        }),
      });

      const json = (await response.json()) as ReportRunRow;
      if (!response.ok) {
        throw new Error((json as { error?: string })?.error ?? "Không thể lưu ngày báo cáo");
      }

      const selectedType = addState.type;
      setRuns((prev) => sortRuns([json, ...prev]));
      closeAddModal();
      notify({
        type: "success",
        title: "Đã thêm ngày báo cáo",
        description: `Loại ${typeLabels[selectedType]} · ${formatDate(json.report_date)}`,
      });
    } catch (error: any) {
      notify({
        type: "error",
        title: "Không thể lưu ngày báo cáo",
        description: error?.message ?? "Có lỗi xảy ra",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editRun) return;
    setSavingEdit(true);

    try {
      const response = await fetch("/api/report-runs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editValues.id,
          type: editValues.type,
          report_date: editValues.reportDate,
          note: editValues.note.trim() || null,
        }),
      });

      const json = (await response.json()) as ReportRunRow;
      if (!response.ok) {
        throw new Error((json as { error?: string })?.error ?? "Không thể cập nhật");
      }

      setRuns((prev) => sortRuns(prev.map((run) => (run.id === json.id ? json : run))));
      notify({
        type: "success",
        title: "Cập nhật thành công",
        description: `Loại ${typeLabels[json.type]} · ${formatDate(json.report_date)}`,
      });
      closeEditModal();
    } catch (error: any) {
      notify({
        type: "error",
        title: "Không thể lưu thay đổi",
        description: error?.message ?? "Có lỗi xảy ra",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa ngày báo cáo này sẽ không thể hoàn tác. Tiếp tục?")) {
      return;
    }
    setDeletingId(id);

    try {
      const response = await fetch("/api/report-runs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((json as { error?: string })?.error ?? "Không thể xóa");
      }

      setRuns((prev) => sortRuns(prev.filter((run) => run.id !== id)));
      setDeletingId(null);
      if (editRun?.id === id) {
        cancelEdit();
      }
      notify({
        type: "success",
        title: "Đã xóa ngày báo cáo",
      });
    } catch (error: any) {
      notify({
        type: "error",
        title: "Không thể xóa",
        description: error?.message ?? "Có lỗi xảy ra",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
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
                    <td className="px-4 py-3">{run.note ?? "-"}</td>
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
                          {deletingId === run.id ? "Đang xóa" : "Xóa"}
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
              onChange={(event) => setAddState((prev) => ({ ...prev, reportDate: event.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="note">Ghi chú (tuỳ chọn)</Label>
            <Textarea
              id="note"
              value={addState.note}
              onChange={(event) => setAddState((prev) => ({ ...prev, note: event.target.value }))}
              rows={1}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={closeAddModal}>
              Hủy
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Đang lưu..." : "Thêm mới"}
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
              onChange={(event) => setEditValues((prev) => ({ ...prev, reportDate: event.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="edit-note">Ghi chú</Label>
            <Textarea
              id="edit-note"
              value={editValues.note}
              onChange={(event) => setEditValues((prev) => ({ ...prev, note: event.target.value }))}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={cancelEdit}>
              Hủy
            </Button>
            <Button type="submit" disabled={savingEdit}>
              {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
