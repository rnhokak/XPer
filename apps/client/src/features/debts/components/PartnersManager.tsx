import { useState, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@/lib/query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { partnerSchema, type PartnerInput } from "@/lib/validation/debts";
import { type Category, type Partner, type DebtRow } from "@/hooks/useDebtsData";
import { type CashflowTransaction } from "@/hooks/useCashflowTransactions";
import { apiClient } from "@/lib/api/client";
import { groupDebtsByPartner } from "./PartnerDebtsList";
import {
  PartnerDebtsDetailDialog,
  type PartnerDebtSummary,
} from "./PartnerDebtsDetailDialog";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Edit2,
  ExternalLink,
  Loader2,
  Lock,
  Phone,
  Plus,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PARTNER_TYPES = [
  { value: "person", label: "Cá nhân (Person)" },
  { value: "bank", label: "Ngân hàng (Bank)" },
  { value: "company", label: "Công ty / Tổ chức (Company)" },
  { value: "other", label: "Khác (Other)" },
];

const PARTNER_TYPE_LABELS: Record<string, string> = {
  person: "Cá nhân",
  bank: "Ngân hàng",
  company: "Công ty",
  other: "Khác",
};

interface PartnersManagerProps {
  partners: Partner[];
  debts?: DebtRow[];
  transactions?: CashflowTransaction[];
  categories?: Category[];
}

export function PartnersManager({
  partners,
  debts = [],
  transactions = [],
}: PartnersManagerProps) {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [deletingPartner, setDeletingPartner] = useState<Partner | null>(null);
  const [selectedPartnerDetail, setSelectedPartnerDetail] = useState<PartnerDebtSummary | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Group debt data by partner
  const partnerSummaries = useMemo(() => {
    return groupDebtsByPartner(debts, partners, transactions);
  }, [debts, partners, transactions]);

  // Lookup map for fast lookup
  const summaryMap = useMemo(() => {
    const map = new Map<string, PartnerDebtSummary>();
    partnerSummaries.forEach((s) => {
      map.set(s.partnerId, s);
      if (s.partnerName) {
        map.set(s.partnerName.trim().toLowerCase(), s);
      }
    });
    return map;
  }, [partnerSummaries]);

  const form = useForm<PartnerInput>({
    resolver: zodResolver(partnerSchema),
    defaultValues: { name: "", type: "person", phone: "", note: "" },
  });

  const openCreateModal = () => {
    setEditingPartner(null);
    setSubmitError(null);
    form.reset({ name: "", type: "person", phone: "", note: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    setSubmitError(null);
    form.reset({
      name: partner.name,
      type: partner.type ?? "person",
      phone: partner.phone ?? "",
      note: partner.note ?? "",
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPartner(null);
    setSubmitError(null);
  };

  const upsertMutation = useMutation({
    mutationFn: async ({ payload, isEdit }: { payload: Record<string, unknown>; isEdit: boolean }) => {
      const response = await apiClient.request({
        url: "/debts/partners",
        method: isEdit ? "PUT" : "POST",
        data: payload,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debts", "partners"] });
      queryClient.invalidateQueries({ queryKey: ["debts", "form"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-accounts"] });
      handleCloseModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete("/debts/partners", { data: { id } });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debts", "partners"] });
      queryClient.invalidateQueries({ queryKey: ["debts", "form"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-accounts"] });
      setDeletingPartner(null);
    },
  });

  const onSubmit = async (values: PartnerInput) => {
    setSubmitError(null);
    const payload = {
      name: values.name.trim(),
      type: values.type?.trim() || null,
      phone: values.phone?.trim() || null,
      note: values.note?.trim() || null,
    };

    try {
      await upsertMutation.mutateAsync({
        payload: editingPartner ? { id: editingPartner.id, ...payload } : payload,
        isEdit: Boolean(editingPartner),
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không thể lưu đối tác");
    }
  };

  const confirmDelete = async () => {
    if (!deletingPartner) return;
    setDeleteError(null);

    const summary = summaryMap.get(deletingPartner.id) || summaryMap.get(deletingPartner.name.trim().toLowerCase());
    const hasDebts = (summary?.debts.length ?? 0) > 0;
    const hasExpenses = (summary?.expenses.length ?? 0) > 0;

    if (hasDebts || hasExpenses) {
      setDeleteError("Không thể xóa đối tác đang có khoản vay/nợ hoặc giao dịch liên kết.");
      return;
    }

    try {
      await deleteMutation.mutateAsync(deletingPartner.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Không thể xóa đối tác");
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(val));

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Tổng số đối tác</p>
          <p className="text-lg font-bold text-slate-900 sm:text-xl">
            {partners.length} người / tổ chức
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm đối tác</span>
        </Button>
      </div>

      {/* Partners List */}
      {partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">Chưa có đối tác nào</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Thêm người hoặc tổ chức liên quan để quản lý các khoản vay, cho vay và chi tiêu chung.
          </p>
          <Button onClick={openCreateModal} variant="outline" size="sm" className="mt-4 rounded-xl">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Thêm đối tác đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => {
            const summary = summaryMap.get(p.id) || summaryMap.get(p.name.trim().toLowerCase());
            const lendAmount = summary?.totalLendOutstanding ?? 0;
            const borrowAmount = summary?.totalBorrowOutstanding ?? 0;
            const totalContracts = summary?.debts.length ?? 0;
            const totalExpenses = summary?.expenses.length ?? 0;
            const totalLinked = totalContracts + totalExpenses;
            const canDelete = totalLinked === 0;

            const isBank = p.type === "bank";
            const isCompany = p.type === "company";
            const typeLabel = (p.type && PARTNER_TYPE_LABELS[p.type]) || p.type || "Cá nhân";

            return (
              <div
                key={p.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs"
              >
                <div>
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          isBank
                            ? "bg-blue-50 text-blue-600"
                            : isCompany
                            ? "bg-purple-50 text-purple-600"
                            : "bg-sky-50 text-sky-600"
                        )}
                      >
                        {isBank ? (
                          <Building2 className="h-5 w-5" />
                        ) : isCompany ? (
                          <Building2 className="h-5 w-5" />
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4
                            onClick={() => summary && setSelectedPartnerDetail(summary)}
                            className="font-semibold text-slate-900 hover:text-blue-600 cursor-pointer truncate max-w-[150px] sm:max-w-[170px]"
                            title="Bấm để xem chi tiết khoản vay/nợ"
                          >
                            {p.name}
                          </h4>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {typeLabel}
                          </span>
                        </div>
                        {p.phone && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{p.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditModal(p)}
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                        title="Sửa thông tin đối tác"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingPartner(p)}
                        disabled={!canDelete || deleteMutation.isPending}
                        className={cn(
                          "h-8 w-8 rounded-lg",
                          canDelete
                            ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            : "opacity-40 cursor-not-allowed text-slate-300"
                        )}
                        title={
                          canDelete
                            ? "Xóa đối tác"
                            : `Không thể xóa: đang có ${totalLinked} khoản vay/giao dịch liên kết`
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Debt Status Card */}
                  <div className="mt-3.5 rounded-xl bg-slate-50/70 p-3 space-y-2">
                    {/* Lend info (đối tác đang nợ mình) */}
                    {lendAmount > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Đang nợ mình:</span>
                        </span>
                        <span className="money-blur font-bold text-emerald-700 sm:text-sm">
                          +{formatCurrency(lendAmount)} đ
                        </span>
                      </div>
                    )}

                    {/* Borrow info (mình đang nợ đối tác / đang vay) */}
                    {borrowAmount > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-rose-700 font-medium">
                          <ArrowDownLeft className="h-3.5 w-3.5 text-rose-600" />
                          <span>Mình đang nợ:</span>
                        </span>
                        <span className="money-blur font-bold text-rose-700 sm:text-sm">
                          -{formatCurrency(borrowAmount)} đ
                        </span>
                      </div>
                    )}

                    {/* When neither lend nor borrow */}
                    {lendAmount === 0 && borrowAmount === 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Trạng thái vay nợ</span>
                        <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-600 font-normal">
                          Không có dư nợ
                        </Badge>
                      </div>
                    )}

                    {/* Contract / Transaction counts */}
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] text-muted-foreground">
                      <span>{totalContracts} hợp đồng vay</span>
                      {summary && (
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerDetail(summary)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <span>Xem chi tiết</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer lock note */}
                {!canDelete && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                    <Lock className="h-3 w-3" />
                    <span>Đã khóa xóa do có {totalLinked} giao dịch/khoản nợ</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingPartner ? "Cập nhật thông tin đối tác" : "Thêm đối tác mới"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Đối tác dùng để theo dõi các khoản vay, cho vay và chi tiêu liên quan.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-700">Tên đối tác *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="VD: Nguyễn Văn A, Techcombank..." className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-700">Phân loại</FormLabel>
                      <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Chọn loại đối tác" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PARTNER_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-700">Số điện thoại</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="VD: 0912345678"
                          className="rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-700">Ghi chú (tuỳ chọn)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        rows={3}
                        placeholder="Thông tin thêm về đối tác..."
                        className="rounded-xl resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {submitError && <p className="text-xs font-medium text-rose-600">{submitError}</p>}

              <DialogFooter className="gap-2 pt-2 sm:space-x-0">
                <Button type="button" variant="outline" onClick={handleCloseModal} className="rounded-xl">
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={upsertMutation.isPending}
                  className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                >
                  {upsertMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : editingPartner ? (
                    "Cập nhật đối tác"
                  ) : (
                    "Thêm đối tác"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={Boolean(deletingPartner)} onOpenChange={(open) => !open && setDeletingPartner(null)}>
        <DialogContent className="max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Xóa đối tác
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Bạn có chắc chắn muốn xóa đối tác <strong>{deletingPartner?.name}</strong>? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-600">
              {deleteError}
            </p>
          )}

          <DialogFooter className="gap-2 pt-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeletingPartner(null);
                setDeleteError(null);
              }}
              className="rounded-xl"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="rounded-xl"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                "Xác nhận xóa"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PARTNER DETAIL DIALOG */}
      <PartnerDebtsDetailDialog
        open={Boolean(selectedPartnerDetail)}
        onClose={() => setSelectedPartnerDetail(null)}
        partnerSummary={selectedPartnerDetail}
      />
    </div>
  );
}
