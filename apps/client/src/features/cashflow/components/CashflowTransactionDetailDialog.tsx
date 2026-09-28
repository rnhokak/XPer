import { useEffect, useMemo, useState } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cashflowQuickAddSchema,
  type CashflowQuickAddValues,
} from "@/lib/validation/cashflow";
import { type CategoryFocus } from "@/lib/validation/categories";
import { type CashflowTransaction } from "@/hooks/useCashflowTransactions";
import { CategoryTreeModal } from "./CategoryTreeModal";
import { CashflowAmountFields } from "./CashflowAmountFields";
import { CashflowDateFields } from "./CashflowDateFields";
import { getCategoryEmoji } from "@/lib/cashflow/categoryUtils";
import {
  isCreditCardAccount,
  isOtherAccount,
  isPartnerAccount,
} from "@/lib/cashflow/accountBalance";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Lock,
  Check,
  Layers,
  ChevronRight,
  Wallet,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer" | "debt";
  parent_id: string | null;
  category_focus: CategoryFocus | null;
};
type Account = {
  id: string;
  name: string;
  currency: string;
  type?: string | null;
  balance?: number | null;
  is_default?: boolean | null;
};

type Props = {
  transaction: CashflowTransaction | null;
  open: boolean;
  categories: Category[];
  accounts: Account[];
  saveError?: string | null;
  deleteError?: string | null;
  isSaving?: boolean;
  isDeleting?: boolean;
  onClose: () => void;
  onSave: (values: CashflowQuickAddValues) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
};

const toLocalInputValue = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toIsoStringWithOffset = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const formatNumber = (value?: number | null, curr?: string) => {
  if (value === undefined || value === null) return "0";
  const isVnd = curr?.toUpperCase() === "VND";
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: isVnd ? 0 : 2,
    minimumFractionDigits: isVnd ? 0 : 2,
  });
};

export function CashflowTransactionDetailDialog({
  transaction,
  open,
  categories,
  accounts,
  saveError,
  deleteError,
  isSaving = false,
  isDeleting = false,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const form = useForm<CashflowQuickAddValues>({
    resolver: zodResolver(cashflowQuickAddSchema),
    defaultValues: {
      type: "expense",
      amount: 0,
      account_id: null,
      destination_account_id: null,
      destination_amount: undefined,
      destination_currency: undefined,
      exchange_rate: undefined,
      category_id: "",
      note: "",
      transaction_time: "",
      currency: "VND",
    },
  });

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Initialize form when transaction opens
  useEffect(() => {
    if (!transaction) return;

    const isTransfer = transaction.type === "transfer";
    const isOutflow = transaction.flow_type !== true; // outflow leg or standard

    const srcAccId = isTransfer
      ? (isOutflow ? (transaction.account_id ?? transaction.account?.id ?? null) : (transaction.destination_account_id ?? transaction.destination_account?.id ?? null))
      : (transaction.account_id ?? transaction.account?.id ?? null);

    const dstAccId = isTransfer
      ? (isOutflow ? (transaction.destination_account_id ?? transaction.destination_account?.id ?? null) : (transaction.account_id ?? transaction.account?.id ?? null))
      : null;

    const srcAmt = isTransfer
      ? (isOutflow ? transaction.amount : (transaction.destination_amount ?? transaction.amount))
      : transaction.amount;

    const dstAmt = isTransfer
      ? (isOutflow ? (transaction.destination_amount ?? transaction.amount) : transaction.amount)
      : undefined;

    const srcCurr = isTransfer
      ? (isOutflow ? transaction.currency : (transaction.destination_currency ?? transaction.currency))
      : transaction.currency;

    const dstCurr = isTransfer
      ? (isOutflow ? (transaction.destination_currency ?? transaction.currency) : transaction.currency)
      : undefined;

    form.reset({
      type: transaction.type,
      amount: srcAmt,
      currency: srcCurr,
      account_id: srcAccId,
      destination_account_id: dstAccId,
      destination_amount: dstAmt,
      destination_currency: dstCurr,
      exchange_rate: transaction.exchange_rate ?? undefined,
      category_id: transaction.category_id ?? transaction.category?.id ?? "",
      note: transaction.note ?? "",
      transaction_time: toLocalInputValue(transaction.transaction_time),
    });
  }, [transaction, form]);

  const selectedType = form.watch("type") ?? transaction?.type ?? "expense";
  const selectedCategoryId = form.watch("category_id");
  const accountId = form.watch("account_id");
  const destinationAccountId = form.watch("destination_account_id");
  const amount = form.watch("amount");
  const currency = form.watch("currency") ?? transaction?.currency ?? "VND";
  const destinationCurrency = form.watch("destination_currency");

  const categoriesByType = useMemo(
    () => categories.filter((c) => c.type === selectedType),
    [categories, selectedType]
  );

  const displayCategoryChips = useMemo(() => {
    return categoriesByType.slice(0, 7);
  }, [categoriesByType]);

  const selectedCategoryObj = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  // Group accounts by purpose
  const personalAccounts = useMemo(
    () => accounts.filter((a) => !isCreditCardAccount(a.type) && !isOtherAccount(a.type) && !isPartnerAccount(a.type)),
    [accounts]
  );
  const creditCardAccounts = useMemo(
    () => accounts.filter((a) => isCreditCardAccount(a.type)),
    [accounts]
  );
  const otherAccounts = useMemo(
    () => accounts.filter((a) => isOtherAccount(a.type)),
    [accounts]
  );

  // Cross-currency transfer detection
  const isTransfer = selectedType === "transfer";
  const destAccountObj = useMemo(
    () => accounts.find((a) => a.id === destinationAccountId),
    [accounts, destinationAccountId]
  );
  const effectiveDestCurrency = destinationCurrency || destAccountObj?.currency || "VND";
  const isDifferentCurrency = Boolean(
    isTransfer &&
    destinationAccountId &&
    currency &&
    effectiveDestCurrency &&
    currency.trim().toUpperCase() !== effectiveDestCurrency.trim().toUpperCase()
  );

  const handleExchangeRateChange = (rateVal: number | undefined) => {
    form.setValue("exchange_rate", rateVal, { shouldValidate: true, shouldDirty: true });
    if (rateVal && rateVal > 0 && typeof amount === "number" && amount > 0) {
      const isVnd = effectiveDestCurrency.toUpperCase() === "VND";
      const calculatedDest = isVnd ? Math.round(amount * rateVal) : Math.round(amount * rateVal * 100) / 100;
      form.setValue("destination_amount", calculatedDest, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleSave = async (values: CashflowQuickAddValues) => {
    if (!transaction) return;
    const normalizedTime = toIsoStringWithOffset(values.transaction_time);
    await onSave({
      ...values,
      type: transaction.type, // Guaranteed fixed type
      category_id: transaction.type === "transfer" ? null : (values.category_id || null),
      account_id: values.account_id || null,
      destination_account_id: transaction.type === "transfer" ? (values.destination_account_id || null) : null,
      destination_amount: transaction.type === "transfer" ? (isDifferentCurrency ? values.destination_amount : values.amount) : null,
      destination_currency: transaction.type === "transfer" ? (isDifferentCurrency ? (values.destination_currency || effectiveDestCurrency) : values.currency) : null,
      exchange_rate: transaction.type === "transfer" ? (isDifferentCurrency ? values.exchange_rate : 1) : null,
      transaction_time: normalizedTime || undefined,
    });
  };

  const handleDelete = async () => {
    if (!transaction) return;
    setConfirmDeleteOpen(false);
    await onDelete();
  };

  const themeColor: "rose" | "emerald" | "blue" =
    selectedType === "expense" ? "rose" : selectedType === "income" ? "emerald" : "blue";

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          className="w-full max-w-[590px] mx-auto my-5 rounded-2xl overflow-hidden max-h-[92vh] overflow-y-auto scale-100 p-5 sm:p-6"
          style={{
            maxHeight: "calc(var(--full-vh, 100vh) - 2rem)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                Chỉnh sửa giao dịch
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Cập nhật số tiền, tài khoản hoặc thông tin chi tiết.
            </DialogDescription>
          </DialogHeader>

          {transaction ? (
            <Form {...form}>
              <form className="space-y-4 pt-2" onSubmit={form.handleSubmit(handleSave)}>
                {/* 1. Transaction Type Banner (LOCKED - Read only) */}
                <div
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3.5 py-2.5 border transition-all",
                    selectedType === "expense" && "bg-rose-50/90 border-rose-200 text-rose-900",
                    selectedType === "income" && "bg-emerald-50/90 border-emerald-200 text-emerald-900",
                    selectedType === "transfer" && "bg-blue-50/90 border-blue-200 text-blue-900"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {selectedType === "expense" && <ArrowDownRight className="h-4 w-4 text-rose-600" />}
                    {selectedType === "income" && <ArrowUpRight className="h-4 w-4 text-emerald-600" />}
                    {selectedType === "transfer" && <ArrowLeftRight className="h-4 w-4 text-blue-600" />}
                    <span className="text-sm font-bold">
                      {selectedType === "expense" && "Chi tiêu (Expense)"}
                      {selectedType === "income" && "Thu nhập (Income)"}
                      {selectedType === "transfer" && "Chuyển khoản (Transfer)"}
                    </span>
                  </div>

                  <span className="flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-2xs border border-slate-200/60">
                    <Lock className="h-3 w-3 text-slate-500" />
                    <span>Loại giao dịch cố định</span>
                  </span>
                </div>

                {/* 2. Amount Field with Hero Input */}
                <CashflowAmountFields
                  control={form.control}
                  currency={currency}
                  themeColor={themeColor}
                  transactionType={selectedType}
                  categories={categoriesByType}
                  onSelectCategory={(catId) => {
                    form.setValue("category_id", catId, { shouldValidate: true, shouldDirty: true });
                  }}
                />

                {/* 3. Transaction Date & Time */}
                <CashflowDateFields control={form.control} />

                {/* 4. Category Selector (Only for Expense & Income) */}
                {selectedType !== "transfer" && (
                  <div className="space-y-2 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3 sm:p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700">
                        Danh mục{" "}
                        {selectedCategoryObj && (
                          <span className="font-normal text-slate-500">({selectedCategoryObj.name})</span>
                        )}
                      </Label>
                      <div className="flex items-center gap-2">
                        {selectedCategoryId && (
                          <button
                            type="button"
                            onClick={() => form.setValue("category_id", "", { shouldValidate: true, shouldDirty: true })}
                            className="text-[11px] font-medium text-rose-500 hover:text-rose-600"
                          >
                            Bỏ chọn
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setCategoryModalOpen(true)}
                          className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          <span>Tất cả ({categoriesByType.length})</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Direct Category Chips */}
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                      {displayCategoryChips.map((cat) => {
                        const isSelected = selectedCategoryId === cat.id;
                        const emoji = getCategoryEmoji(cat.name);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                form.setValue("category_id", "", { shouldValidate: true, shouldDirty: true });
                              } else {
                                form.setValue("category_id", cat.id, { shouldValidate: true, shouldDirty: true });
                              }
                            }}
                            className={cn(
                              "flex items-center gap-1.5 rounded-xl border p-2 text-left text-xs font-medium transition-all active:scale-[0.98]",
                              isSelected
                                ? selectedType === "expense"
                                  ? "border-rose-400 bg-rose-50 text-rose-800 shadow-2xs ring-2 ring-rose-400/30 font-semibold"
                                  : "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-2xs ring-2 ring-emerald-400/30 font-semibold"
                                : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80"
                            )}
                          >
                            <span className="shrink-0 text-sm sm:text-base">{emoji}</span>
                            <span className="truncate flex-1">{cat.name}</span>
                            {isSelected && <Check className="h-3 w-3 shrink-0 text-current" />}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setCategoryModalOpen(true)}
                        className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-2 text-xs font-medium text-slate-500 transition-all hover:border-slate-400 hover:bg-slate-100/70 active:scale-[0.98]"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>Khác...</span>
                      </button>
                    </div>

                    <CategoryTreeModal
                      open={categoryModalOpen}
                      onClose={() => setCategoryModalOpen(false)}
                      categories={categoriesByType}
                      selected={selectedCategoryId || null}
                      onSelect={(next) => {
                        form.setValue("category_id", next ?? "", { shouldValidate: true, shouldDirty: true });
                      }}
                      suggestedId={null}
                    />
                  </div>
                )}

                {/* 5. Account Selection */}
                {selectedType !== "transfer" ? (
                  /* Standard Expense/Income Account */
                  <FormField
                    control={form.control}
                    name="account_id"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-slate-700">
                          {selectedType === "expense" ? "Tài khoản thanh toán" : "Tài khoản nhận tiền"}
                        </FormLabel>
                        <Select
                          value={field.value ?? undefined}
                          onValueChange={(val) => {
                            const nextVal = val === "none" ? null : val;
                            field.onChange(nextVal);
                            const found = nextVal ? accounts.find((a) => a.id === nextVal) : null;
                            if (found?.currency) {
                              form.setValue("currency", found.currency);
                            }
                          }}
                        >
                          <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm">
                            <div className="flex items-center gap-2 truncate">
                              <Wallet className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <SelectValue placeholder="Chọn tài khoản..." />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {personalAccounts.length > 0 && (
                              <>
                                <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100/70 rounded-md">
                                  💳 Tài khoản cá nhân của tôi
                                </div>
                                {personalAccounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                      <span className="font-medium truncate">{acc.name}</span>
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        ({formatNumber(acc.balance, acc.currency)} {acc.currency})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </>
                            )}

                            {selectedType === "expense" && creditCardAccounts.length > 0 && (
                              <>
                                <div className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-100/70 rounded-md mt-1">
                                  💳 Thẻ tín dụng
                                </div>
                                {creditCardAccounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                      <span className="font-medium truncate">{acc.name}</span>
                                      <span className="text-xs text-amber-700 whitespace-nowrap">
                                        (Dư nợ: {formatNumber(acc.balance, acc.currency)} {acc.currency})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </>
                            )}

                            {otherAccounts.length > 0 && (
                              <>
                                <div className="px-2 py-1 text-[11px] font-semibold text-purple-800 bg-purple-100/70 rounded-md mt-1">
                                  👥 Tài khoản khác
                                </div>
                                {otherAccounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                      <span className="font-medium truncate">{acc.name}</span>
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        ({formatNumber(acc.balance, acc.currency)} {acc.currency})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs text-rose-500 font-medium">
                          {form.formState.errors.account_id?.message}
                        </FormMessage>
                      </FormItem>
                    )}
                  />
                ) : (
                  /* Transfer: Source & Destination Accounts */
                  <div className="space-y-3 rounded-2xl border border-blue-200/80 bg-blue-50/40 p-3 sm:p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Source Account */}
                      <FormField
                        control={form.control}
                        name="account_id"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                              <span>Nguồn (Chuyển đi)</span>
                            </FormLabel>
                            <Select
                              value={field.value ?? undefined}
                              onValueChange={(val) => {
                                field.onChange(val);
                                const found = accounts.find((a) => a.id === val);
                                if (found?.currency) {
                                  form.setValue("currency", found.currency);
                                }
                              }}
                            >
                              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm">
                                <div className="flex items-center gap-2 truncate">
                                  <Wallet className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <SelectValue placeholder="Chọn tài khoản nguồn..." />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                                    <div className="flex items-center justify-between gap-2 w-full">
                                      <span className="font-medium truncate">{acc.name}</span>
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        ({formatNumber(acc.balance, acc.currency)} {acc.currency})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs text-rose-500 font-medium">
                              {form.formState.errors.account_id?.message}
                            </FormMessage>
                          </FormItem>
                        )}
                      />

                      {/* Destination Account */}
                      <FormField
                        control={form.control}
                        name="destination_account_id"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                              <span>Đích (Nhận tiền)</span>
                            </FormLabel>
                            <Select
                              value={field.value ?? undefined}
                              onValueChange={(val) => {
                                field.onChange(val);
                                const found = accounts.find((a) => a.id === val);
                                if (found?.currency) {
                                  form.setValue("destination_currency", found.currency);
                                }
                              }}
                            >
                              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm">
                                <div className="flex items-center gap-2 truncate">
                                  <Wallet className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <SelectValue placeholder="Chọn tài khoản đích..." />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {accounts
                                  .filter((a) => a.id !== accountId)
                                  .map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                                      <div className="flex items-center justify-between gap-2 w-full">
                                        <span className="font-medium truncate">{acc.name}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                          ({formatNumber(acc.balance, acc.currency)} {acc.currency})
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs text-rose-500 font-medium">
                              {form.formState.errors.destination_account_id?.message}
                            </FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Cross-Currency fields if currencies differ */}
                    {isDifferentCurrency && (
                      <div className="space-y-2 rounded-xl border border-blue-200 bg-white p-3 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-blue-900">💱 Chuyển đổi ngoại tệ</span>
                          <span className="text-muted-foreground font-medium">
                            {currency} ➔ {effectiveDestCurrency}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <FormField
                            control={form.control}
                            name="destination_amount"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="text-[11px] font-medium text-slate-600">
                                  Số tiền nhận ({effectiveDestCurrency})
                                </FormLabel>
                                <Input
                                  type="number"
                                  step="any"
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : undefined;
                                    field.onChange(val);
                                    if (val && val > 0 && typeof amount === "number" && amount > 0) {
                                      form.setValue("exchange_rate", Math.round((val / amount) * 10000) / 10000);
                                    }
                                  }}
                                  placeholder="Nhập số tiền..."
                                  className="h-8.5 rounded-lg border-slate-200 bg-white text-xs"
                                />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="exchange_rate"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="text-[11px] font-medium text-slate-600">
                                  Tỷ giá quy đổi
                                </FormLabel>
                                <Input
                                  type="number"
                                  step="any"
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : undefined;
                                    handleExchangeRateChange(val);
                                  }}
                                  placeholder="Ví dụ: 25400"
                                  className="h-8.5 rounded-lg border-slate-200 bg-white text-xs"
                                />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Note Field */}
                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold text-slate-700">Ghi chú</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          rows={2}
                          placeholder="Thêm ghi chú chi tiêu, chuyển tiền..."
                          className="rounded-xl border-slate-200 bg-white text-xs sm:text-sm resize-none focus:border-primary"
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-rose-500 font-medium">
                        {form.formState.errors.note?.message}
                      </FormMessage>
                    </FormItem>
                  )}
                />

                {/* Error messages */}
                {saveError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{saveError}</span>
                  </div>
                )}
                {deleteError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{deleteError}</span>
                  </div>
                )}

                {/* Footer Buttons */}
                <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-3 border-t border-slate-100 sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={isDeleting || isSaving}
                    className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Xoá giao dịch</span>
                    <span className="sm:hidden">Xoá</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onClose}
                      disabled={isSaving}
                      className="rounded-xl border-slate-200"
                    >
                      Huỷ
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSaving}
                      className={cn(
                        "rounded-xl font-semibold shadow-xs transition-all active:scale-95 text-white min-w-[120px]",
                        selectedType === "expense" && "bg-rose-600 hover:bg-rose-700",
                        selectedType === "income" && "bg-emerald-600 hover:bg-emerald-700",
                        selectedType === "transfer" && "bg-blue-600 hover:bg-blue-700"
                      )}
                    >
                      {isSaving ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Đang lưu...</span>
                        </span>
                      ) : (
                        "Lưu thay đổi"
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Deletion */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="w-full max-w-[440px] mx-auto rounded-2xl p-5 sm:p-6">
          <DialogHeader className="space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Xác nhận xoá giao dịch
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              Bạn có chắc chắn muốn xoá giao dịch này? Số tiền sẽ được hoàn hoặc trừ lại vào tài khoản tương ứng và hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={isDeleting}
              className="rounded-xl"
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl min-w-[100px]"
            >
              {isDeleting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang xoá...</span>
                </span>
              ) : (
                "Xoá vĩnh viễn"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
