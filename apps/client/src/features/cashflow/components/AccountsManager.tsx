import { useState, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  accountSchema,
  updateAccountSchema,
  type AccountInput,
  type UpdateAccountInput,
} from "@/lib/validation/accounts";
import {
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  type CashflowAccount,
  type CashflowTransaction,
} from "@/hooks/useCashflowTransactions";
import {
  calculateAccountBalance,
  AVAILABLE_ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  isOtherAccount,
  isMyAccount,
} from "@/lib/cashflow/accountBalance";
import {
  Coins,
  CreditCard,
  Edit2,
  Landmark,
  Loader2,
  Lock,
  Plus,
  Smartphone,
  Star,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountsManagerProps {
  accounts: CashflowAccount[];
  transactions?: CashflowTransaction[];
  scope?: "my" | "other";
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function AccountsManager({
  accounts,
  transactions = [],
  scope = "my",
  onRefresh,
  isRefreshing,
}: AccountsManagerProps) {
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CashflowAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<CashflowAccount | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter accounts according to scope
  const regularAccounts = useMemo(() => {
    if (scope === "other") {
      return accounts.filter((a) => isOtherAccount(a.type));
    }
    return accounts.filter((a) => isMyAccount(a.type));
  }, [accounts, scope]);

  // Form setup for Create
  const createForm = useForm<AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: scope === "other" ? "other" : "bank",
      currency: "VND",
      balance: 0,
      is_default: false,
    },
  });

  // Form setup for Edit (only name & is_default)
  const editForm = useForm<UpdateAccountInput>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: {
      name: "",
      is_default: false,
    },
  });

  const openCreateModal = () => {
    setEditingAccount(null);
    setSubmitError(null);
    createForm.reset({
      name: "",
      type: scope === "other" ? "other" : "bank",
      currency: "VND",
      balance: 0,
      is_default: scope === "my" && regularAccounts.length === 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (acc: CashflowAccount) => {
    setEditingAccount(acc);
    setSubmitError(null);
    editForm.reset({
      name: acc.name,
      is_default: Boolean(acc.is_default),
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setSubmitError(null);
  };

  const onSaveCreate = async (values: AccountInput) => {
    setSubmitError(null);
    const payload = {
      ...values,
      name: values.name.trim(),
      type: values.type.trim(),
      currency: values.currency?.trim() || "VND",
      balance: Number(values.balance) || 0,
      is_default: Boolean(values.is_default),
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        handleCloseModal();
      },
      onError: (error) => {
        setSubmitError(error.message ?? "Không thể tạo tài khoản");
      },
    });
  };

  const onSaveEdit = async (values: UpdateAccountInput) => {
    if (!editingAccount) return;
    setSubmitError(null);
    const payload = {
      name: values.name.trim(),
      is_default: Boolean(values.is_default),
    };

    updateMutation.mutate(
      { id: editingAccount.id, values: payload },
      {
        onSuccess: () => {
          handleCloseModal();
        },
        onError: (error) => {
          setSubmitError(error.message ?? "Không thể cập nhật tài khoản");
        },
      }
    );
  };

  const confirmDelete = async () => {
    if (!deletingAccount) return;
    setDeleteError(null);

    // Double check transaction count before delete
    const stats = calculateAccountBalance(deletingAccount, transactions);
    if (stats.transactionCount > 0) {
      setDeleteError(`Tài khoản đang có ${stats.transactionCount} giao dịch, không thể xóa.`);
      return;
    }

    deleteMutation.mutate(deletingAccount.id, {
      onSuccess: () => {
        setDeletingAccount(null);
      },
      onError: (err) => {
        setDeleteError(err.message ?? "Không thể xóa tài khoản.");
      },
    });
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(val));

  // Compute stats across accounts
  const overallSummary = useMemo(() => {
    let totalLiquid = 0;
    let totalCreditDebt = 0;

    regularAccounts.forEach((acc) => {
      // Skip other person's accounts in personal liquid balance
      if (isOtherAccount(acc.type)) return;

      const stats = calculateAccountBalance(acc, transactions);
      if (stats.isCreditCard) {
        if (stats.currentBalance < 0) {
          totalCreditDebt += Math.abs(stats.currentBalance);
        }
      } else {
        totalLiquid += stats.currentBalance;
      }
    });

    return { totalLiquid, totalCreditDebt };
  }, [regularAccounts, transactions]);

  const otherSummary = useMemo(() => {
    let totalBalance = 0;
    regularAccounts.forEach((acc) => {
      totalBalance += Number(acc.balance ?? 0);
    });
    return { count: regularAccounts.length, totalBalance };
  }, [regularAccounts]);

  // Account type icon mapping
  const renderAccountIcon = (type: string | null | undefined) => {
    const t = type?.toLowerCase() ?? "";
    if (t === "cash") {
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Wallet className="h-5 w-5" />
        </div>
      );
    }
    if (t === "bank") {
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Landmark className="h-5 w-5" />
        </div>
      );
    }
    if (t === "credit" || t === "credit_card") {
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <CreditCard className="h-5 w-5" />
        </div>
      );
    }
    if (t === "debit") {
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <CreditCard className="h-5 w-5" />
        </div>
      );
    }
    if (t === "e-wallet") {
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Smartphone className="h-5 w-5" />
        </div>
      );
    }
    if (t === "broker") {
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
          <TrendingUp className="h-5 w-5" />
        </div>
      );
    }
    if (t === "other" || t === "external") {
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
          <User className="h-5 w-5" />
        </div>
      );
    }
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <Coins className="h-5 w-5" />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top action & stat bar */}
      {scope === "other" ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-purple-100 bg-purple-50/40 p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tổng số tài khoản</p>
              <p className="text-lg font-bold text-slate-900 sm:text-xl">
                {otherSummary.count} tài khoản
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tổng số dư</p>
              <p className="money-blur text-lg font-bold text-purple-700 sm:text-xl">
                {formatCurrency(otherSummary.totalBalance)} đ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 rounded-xl border-purple-200 bg-white px-3 py-2 text-sm font-semibold text-purple-700 shadow-2xs hover:bg-purple-50 active:scale-95 transition-all"
                title="Làm mới số dư tài khoản"
              >
                <RotateCw className={cn("h-4 w-4", isRefreshing && "animate-spin text-purple-700")} />
                <span className="hidden sm:inline">{isRefreshing ? "Đang tải..." : "Làm mới"}</span>
              </Button>
            )}
            <Button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-800 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm tài khoản khác</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tổng số dư thanh toán</p>
              <p className="money-blur text-lg font-bold text-slate-900 sm:text-xl">
                {formatCurrency(overallSummary.totalLiquid)} đ
              </p>
            </div>
            {overallSummary.totalCreditDebt > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Dư nợ thẻ tín dụng</p>
                <p className="money-blur text-lg font-bold text-rose-600 sm:text-xl">
                  -{formatCurrency(overallSummary.totalCreditDebt)} đ
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 rounded-xl border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all"
                title="Làm mới số dư tài khoản"
              >
                <RotateCw className={cn("h-4 w-4", isRefreshing && "animate-spin text-primary")} />
                <span className="hidden sm:inline">{isRefreshing ? "Đang tải..." : "Làm mới"}</span>
              </Button>
            )}
            <Button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm tài khoản</span>
            </Button>
          </div>
        </div>
      )}

      {/* Account Cards List */}
      {regularAccounts.length === 0 ? (
        scope === "other" ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-purple-200 bg-purple-50/20 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 mb-3">
              <User className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Chưa có tài khoản khác nào</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Tạo tài khoản người khác (ví dụ: Vợ, Người thân, Bạn bè) để theo dõi các giao dịch chuyển tiền luân chuyển.
            </p>
            <Button onClick={openCreateModal} variant="outline" size="sm" className="mt-4 rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Tạo tài khoản khác
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <CreditCard className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Chưa có tài khoản nào</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Tạo tài khoản tiền mặt, ngân hàng hoặc thẻ tín dụng để bắt đầu theo dõi thu chi.
            </p>
            <Button onClick={openCreateModal} variant="outline" size="sm" className="mt-4 rounded-xl">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Tạo tài khoản đầu tiên
            </Button>
          </div>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {regularAccounts.map((acc) => {
            const stats = calculateAccountBalance(acc, transactions);
            const typeLabel = (acc.type && ACCOUNT_TYPE_LABELS[acc.type]) || acc.type || "Khác";
            const canDelete = stats.transactionCount === 0;

            return (
              <div
                key={acc.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs"
              >
                {/* Header row */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {renderAccountIcon(acc.type)}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-slate-900 truncate max-w-[150px] sm:max-w-[170px]" title={acc.name}>
                            {acc.name}
                          </h4>
                          {acc.is_default && (
                            <span
                              title="Tài khoản mặc định"
                              className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/70"
                            >
                              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              Mặc định
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-medium text-slate-600">{typeLabel}</span>
                          {isOtherAccount(acc.type) && (
                            <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200/70">
                              Người khác · Chỉ nhận chuyển tiền
                            </span>
                          )}
                          <span>•</span>
                          <span>{acc.currency}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditModal(acc)}
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                        title="Sửa tài khoản"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingAccount(acc)}
                        disabled={!canDelete || deleteMutation.isPending}
                        className={cn(
                          "h-8 w-8 rounded-lg",
                          canDelete
                            ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            : "opacity-40 cursor-not-allowed text-slate-300"
                        )}
                        title={
                          canDelete
                            ? "Xóa tài khoản"
                            : `Không thể xóa: đang có ${stats.transactionCount} giao dịch liên kết`
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Balance Section */}
                  <div className="mt-4 rounded-xl bg-slate-50/70 p-3">
                    {stats.isCreditCard ? (
                      /* Credit Card Logic */
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Dư nợ tín dụng</span>
                          {stats.currentBalance < 0 ? (
                            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] text-rose-700 font-semibold">
                              Đang nợ
                            </Badge>
                          ) : stats.currentBalance > 0 ? (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 font-semibold">
                              Dư trong thẻ
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-600 font-semibold">
                              Không có dư nợ
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-baseline gap-1">
                          {stats.currentBalance < 0 ? (
                            <p className="money-blur text-lg font-bold text-rose-600 sm:text-xl">
                              -{formatCurrency(Math.abs(stats.currentBalance))} đ
                            </p>
                          ) : stats.currentBalance > 0 ? (
                            <p className="money-blur text-lg font-bold text-emerald-600 sm:text-xl">
                              +{formatCurrency(stats.currentBalance)} đ
                            </p>
                          ) : (
                            <p className="money-blur text-lg font-bold text-slate-700 sm:text-xl">
                              0 đ
                            </p>
                          )}
                        </div>
                        {stats.currentBalance > 0 && (
                          <p className="mt-0.5 text-[11px] text-emerald-600">
                            (Đang để tiền trong thẻ, không có nợ)
                          </p>
                        )}
                      </div>
                    ) : (
                      /* Standard Account Logic */
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Số tiền hiện có</span>
                          {stats.currentBalance < 0 && (
                            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] text-rose-700 font-semibold">
                              Thấu chi
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1">
                          <p
                            className={cn(
                              "money-blur text-lg font-bold sm:text-xl",
                              stats.currentBalance >= 0 ? "text-slate-900" : "text-rose-600"
                            )}
                          >
                            {stats.currentBalance < 0 && "-"}
                            {formatCurrency(Math.abs(stats.currentBalance))} đ
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Sub metadata */}
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] text-muted-foreground">
                      <span>
                        Số dư:{" "}
                        <strong className="text-slate-700">{formatCurrency(stats.currentBalance)} {acc.currency}</strong>
                      </span>
                      <span className={stats.transactionCount > 0 ? "text-slate-600 font-medium" : "text-slate-400"}>
                        {stats.transactionCount} GD
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer lock note if transactions exist */}
                {!canDelete && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                    <Lock className="h-3 w-3" />
                    <span>Đã khóa xóa do có {stats.transactionCount} giao dịch</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingAccount
                ? "Chỉnh sửa tài khoản"
                : scope === "other"
                ? "Thêm tài khoản khác"
                : "Thêm tài khoản mới"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingAccount
                ? "Theo quy định, bạn chỉ có thể sửa tên và đổi trạng thái mặc định. Loại tài khoản không thể sửa."
                : scope === "other"
                ? "Tạo tài khoản người khác (ví dụ: Vợ, Người thân, Bạn bè) để theo dõi các giao dịch chuyển tiền."
                : "Điền thông tin để tạo tài khoản thanh toán hoặc thẻ tín dụng mới."}
            </DialogDescription>
          </DialogHeader>

          {editingAccount ? (
            /* EDIT FORM */
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onSaveEdit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-700">Tên tài khoản</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="VD: Techcombank, Tiền mặt..." className="rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Read-only Type Display */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <span>Loại tài khoản</span>
                    <span className="text-xs text-muted-foreground">(Cố định, không được sửa)</span>
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium">
                      {(editingAccount.type && ACCOUNT_TYPE_LABELS[editingAccount.type]) ||
                        editingAccount.type ||
                        "Khác"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Loại tài khoản được giữ nguyên để đảm bảo tính toàn vẹn của lịch sử giao dịch.
                  </p>
                </div>

                {/* Default Account Checkbox */}
                <FormField
                  control={editForm.control}
                  name="is_default"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                      <input
                        type="checkbox"
                        id="edit_is_default"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <label htmlFor="edit_is_default" className="text-xs font-medium text-slate-800 cursor-pointer">
                        Đặt làm tài khoản mặc định (Set as default account)
                      </label>
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
                    disabled={updateMutation.isPending}
                    className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      "Lưu thay đổi"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            /* CREATE FORM */
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onSaveCreate)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-700">Tên tài khoản *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="VD: Vietcombank, Tiền mặt ví, Thẻ VPBank..." className="rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    control={createForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          Loại tài khoản * <span className="text-[11px] font-normal text-rose-500">(Bắt buộc)</span>
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={scope === "other"}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Chọn loại tài khoản" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(scope === "other"
                              ? AVAILABLE_ACCOUNT_TYPES.filter((t) => t.value === "other")
                              : AVAILABLE_ACCOUNT_TYPES.filter((t) => t.value !== "other")
                            ).map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isOtherAccount(field.value) && (
                          <p className="mt-1 text-[11px] text-purple-600 font-medium">
                            * Tài khoản người khác: Dùng để chuyển tiền luân chuyển (ví dụ: tài khoản vợ, người thân).
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-700">Đơn vị tiền tệ</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="VND" className="rounded-xl uppercase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Balance Field */}
                <FormField
                  control={createForm.control}
                  name="balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-700">
                        Tiền vào tài khoản / Số dư ban đầu
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          {...field}
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="rounded-xl text-base font-semibold"
                        />
                      </FormControl>
                      <FormDescription className="text-[11px]">
                        Số tiền hiện có khi tạo tài khoản. Với thẻ tín dụng, nếu đang nợ có thể nhập số âm hoặc để 0.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Default Account Checkbox */}
                <FormField
                  control={createForm.control}
                  name="is_default"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                      <input
                        type="checkbox"
                        id="create_is_default"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <label htmlFor="create_is_default" className="text-xs font-medium text-slate-800 cursor-pointer">
                        Đặt làm tài khoản mặc định (Set as default account)
                      </label>
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
                    disabled={createMutation.isPending}
                    className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Đang tạo...
                      </>
                    ) : (
                      "Tạo tài khoản"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={Boolean(deletingAccount)} onOpenChange={(open) => !open && setDeletingAccount(null)}>
        <DialogContent className="max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Xóa tài khoản
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Bạn có chắc chắn muốn xóa tài khoản <strong>{deletingAccount?.name}</strong>? Hành động này không thể hoàn tác.
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
                setDeletingAccount(null);
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
    </div>
  );
}
