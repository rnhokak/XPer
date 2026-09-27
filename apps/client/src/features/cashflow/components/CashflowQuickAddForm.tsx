"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  cashflowQuickAddSchema,
  type CashflowQuickAddValues,
  type CashflowTransactionType,
} from "@/lib/validation/cashflow";
import { useQueryClient } from "@/lib/query";
import {
  cashflowReportTransactionsQueryKey,
  cashflowTransactionsQueryKey,
  type CashflowTransaction,
  useCashflowReportTransactions,
  useCreateTransaction,
} from "@/hooks/useCashflowTransactions";
import { normalizeCashflowRange, rangeBounds } from "@/lib/cashflow/utils";
import { type CategoryFocus } from "@/lib/validation/categories";
import { useNotificationsStore } from "@/store/notifications";
import { CategoryTreeModal } from "./CategoryTreeModal";
import { CashflowAmountFields } from "./CashflowAmountFields";
import { CashflowDateFields } from "./CashflowDateFields";
import {
  formatDebtExpenseNote,
  type DebtExpenseMode,
} from "@/lib/cashflow/debtExpenseUtils";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CreditCard,
  HandCoins,
  Layers,
  PenLine,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer" | "debt";
  parent_id: string | null;
  category_focus: CategoryFocus | null;
};
type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };
type Partner = { id: string; name: string };

type Props = {
  categories: Category[];
  accounts: Account[];
  partners?: Partner[];
  defaultAccountId?: string | null;
  defaultCurrency: string;
  useDialog?: boolean;
  range: string;
  isLoading?: boolean;
};

const CUSTOM_CURRENCY = "__custom__";
const CURRENCIES = ["VND", "USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD", "CNY"];
const lastCategoryKey = (type: CashflowTransactionType) => `cashflow:lastCategory:${type}`;

const toIsoStringWithOffset = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const defaultDateTimeValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 23);
};

const getCurrentDateTimeValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 23);
};

import { getCategoryEmoji } from "@/lib/cashflow/categoryUtils";
export { getCategoryEmoji };

export function CashflowQuickAddForm({
  categories,
  accounts,
  partners = [],
  defaultAccountId,
  defaultCurrency,
  useDialog = false,
  range,
  isLoading = false,
}: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customCurrency, setCustomCurrency] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [lastTransactionTime, setLastTransactionTime] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const queryClient = useQueryClient();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [showCurrencySelect, setShowCurrencySelect] = useState(false);
  const [debtMode, setDebtMode] = useState<DebtExpenseMode>("none");
  const [debtPartnerName, setDebtPartnerName] = useState("");

  const form = useForm<CashflowQuickAddValues>({
    resolver: zodResolver(cashflowQuickAddSchema),
    mode: "onChange",
    defaultValues: {
      type: "expense",
      amount: undefined,
      account_id: defaultAccountId ?? null,
      category_id: "",
      note: "",
      transaction_time: lastTransactionTime ? lastTransactionTime : defaultDateTimeValue(),
      currency: defaultCurrency,
    },
  });

  useEffect(() => {
    if (!useDialog) return;
    if (typeof window === "undefined") return;

    const updateViewportHeight = () => {
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;
      setViewportHeight(nextHeight);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updateViewportHeight);
    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      viewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, [useDialog]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    form.setValue("account_id", defaultAccountId ?? null);
    form.setValue("currency", defaultCurrency);
  }, [defaultAccountId, defaultCurrency, form]);

  const selectedType = useWatch({ control: form.control, name: "type" }) ?? "expense";
  const selectedCategoryId = useWatch({ control: form.control, name: "category_id" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const currency = useWatch({ control: form.control, name: "currency" }) ?? defaultCurrency;

  const categoriesByType = useMemo(
    () => categories.filter((c) => c.type === selectedType),
    [categories, selectedType]
  );
  const { data: reportTransactions = [] } = useCashflowReportTransactions();

  // Top smart categories sorted by recent usage
  const displayCategoryChips = useMemo(() => {
    const counts = new Map<string, number>();

    [...reportTransactions]
      .filter((tx) => tx.type === selectedType && tx.category?.id)
      .sort((a, b) => new Date(b.transaction_time).getTime() - new Date(a.transaction_time).getTime())
      .slice(0, 40)
      .forEach((tx) => {
        const catId = tx.category?.id;
        if (!catId) return;
        counts.set(catId, (counts.get(catId) ?? 0) + 1);
      });

    // Check last used category for this type
    let lastUsedId: string | null = null;
    try {
      lastUsedId = localStorage.getItem(lastCategoryKey(selectedType));
    } catch {
      // ignore
    }

    const sorted = [...categoriesByType].sort((a, b) => {
      if (a.id === lastUsedId) return -1;
      if (b.id === lastUsedId) return 1;
      const countA = counts.get(a.id) ?? 0;
      const countB = counts.get(b.id) ?? 0;
      if (countA !== countB) return countB - countA;
      return a.name.localeCompare(b.name);
    });

    const topList = sorted.slice(0, 7);

    // If the currently selected category is not in the top list, include it at the beginning
    if (selectedCategoryId) {
      const selectedCategory = categoriesByType.find((c) => c.id === selectedCategoryId);
      if (selectedCategory && !topList.some((c) => c.id === selectedCategoryId)) {
        return [selectedCategory, ...topList.slice(0, 6)];
      }
    }

    return topList;
  }, [categoriesByType, reportTransactions, selectedCategoryId, selectedType]);

  const selectedCategoryObj = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const notify = useNotificationsStore((state) => state.notify);
  const createMutation = useCreateTransaction();
  const isSubmitting = createMutation.isPending;

  // Validation state: Amount MUST be entered and > 0, account must be selected, and category MUST be selected
  const isValidAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0;
  const hasAccount = accounts.length === 0 || Boolean(accountId);
  const hasCategory = Boolean(selectedCategoryId && selectedCategoryId.trim().length > 0);
  const canSubmit = isValidAmount && hasAccount && hasCategory && !isSubmitting;

  const onSubmit = async (values: CashflowQuickAddValues) => {
    if (!isValidAmount || !hasCategory) return;
    setSubmitError(null);
    const transactionTimeIso = toIsoStringWithOffset(values.transaction_time);

    // Format note with debt expense tags if expense mode is active
    const rawNote = values.note?.trim() || "";
    const activeDebtMode = values.type === "expense" ? debtMode : "none";
    const partnerToSave = debtPartnerName.trim() || (activeDebtMode === "borrowed_spent" ? "Người cho vay" : "Người được mua hộ");
    const finalNote = formatDebtExpenseNote(
      rawNote,
      activeDebtMode,
      partnerToSave
    );

    const payload = {
      ...values,
      note: finalNote || null,
      category_id: values.category_id,
      account_id: values.account_id || defaultAccountId || null,
      transaction_time: transactionTimeIso ?? undefined,
      currency: values.currency || defaultCurrency,
    };

    createMutation.mutate(payload, {
      onSuccess: (response) => {
        const normalizedRange = normalizeCashflowRange(range);
        const { start, end } = rangeBounds(normalizedRange, 0);
        const transactionDate = new Date(response.transaction_time);
        if (!Number.isNaN(transactionDate.getTime()) && transactionDate >= start && transactionDate < end) {
          queryClient.setQueryData<CashflowTransaction[]>(cashflowTransactionsQueryKey(range, 0), (prev) => {
            const existing = (prev ?? []).filter((tx) => tx.id !== response.id);
            return [response, ...existing];
          });
          queryClient.setQueryData<CashflowTransaction[]>(cashflowReportTransactionsQueryKey, (prev) => {
            const existing = (prev ?? []).filter((tx) => tx.id !== response.id);
            return [response, ...existing];
          });
        }
        const submittedTime = values.transaction_time ? new Date(values.transaction_time) : new Date();
        submittedTime.setMilliseconds(submittedTime.getMilliseconds() + 1);
        const nextTransactionTime = Number.isNaN(submittedTime.getTime())
          ? getCurrentDateTimeValue()
          : (() => {
              const local = new Date(submittedTime.getTime() - submittedTime.getTimezoneOffset() * 60000);
              return local.toISOString().slice(0, 23);
            })();

        setLastTransactionTime(nextTransactionTime);

        form.reset({
          type: values.type,
          amount: undefined,
          account_id: payload.account_id,
          category_id: "",
          note: "",
          transaction_time: nextTransactionTime,
          currency: defaultCurrency,
        });

        // Reset debt expense selection
        setDebtMode("none");
        setDebtPartnerName("");

        try {
          if (payload.category_id && payload.type !== "transfer") {
            localStorage.setItem(lastCategoryKey(payload.type ?? "expense"), payload.category_id);
          }
        } catch {
          // ignore storage errors
        }
        if (useDialog) {
          setDialogOpen(false);
        }
        persistRecentAmount(values.amount ?? 0, payload.currency ?? defaultCurrency);

        notify({
          title: "Thành công",
          description: "Đã thêm giao dịch thành công!",
          type: "success",
        });
      },
      onError: (error) => {
        const message = error.message || "Không thể thêm giao dịch";
        setSubmitError(message);
        notify({
          title: "Lỗi",
          description: message,
          type: "error",
        });
      },
    });
  };

  const persistRecentAmount = (value: number, curr: string) => {
    if (!Number.isFinite(value) || value <= 0) return;
    const key = `cashflow:recentAmounts:${curr}`;
    try {
      const existingRaw = localStorage.getItem(key);
      const existing: Array<{ amount: number; ts: number }> = existingRaw ? JSON.parse(existingRaw) : [];
      const now = Date.now();
      const merged = [{ amount: value, ts: now }, ...existing.filter((item) => item.amount !== value)].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(merged));
    } catch {
      // ignore storage errors
    }
  };

  const dialogMaxHeight = useDialog && viewportHeight ? Math.max(360, viewportHeight - 32) : null;

  const currentThemeColor: "rose" | "emerald" | "blue" =
    selectedType === "expense" ? "rose" : selectedType === "income" ? "emerald" : "blue";

  const formContent = isLoading ? (
    <div className="space-y-4 py-2">
      <div className="h-10 w-full animate-pulse rounded-2xl bg-muted" />
      <div className="h-16 w-full animate-pulse rounded-2xl bg-muted" />
      <div className="h-28 w-full animate-pulse rounded-2xl bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-2xl bg-muted" />
    </div>
  ) : (
    <div className="space-y-4">
      <Form {...form}>
        <form id="cashflow-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {/* Transaction Type Segmented Control */}
          <div className="flex items-center rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => form.setValue("type", "expense")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all duration-150 sm:text-sm active:scale-95",
                selectedType === "expense"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ArrowDownRight className="h-3.5 w-3.5" />
              <span>Chi tiêu</span>
            </button>
            <button
              type="button"
              onClick={() => form.setValue("type", "income")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all duration-150 sm:text-sm active:scale-95",
                selectedType === "income"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Thu nhập</span>
            </button>
            <button
              type="button"
              onClick={() => form.setValue("type", "transfer")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all duration-150 sm:text-sm active:scale-95",
                selectedType === "transfer"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Chuyển khoản</span>
            </button>
          </div>

          {/* Amount Field with Hero Input & Quick Presets */}
          <CashflowAmountFields
            control={form.control}
            currency={currency}
            themeColor={currentThemeColor}
            transactionType={selectedType}
            categories={categoriesByType}
            onSelectCategory={(catId) => {
              form.setValue("category_id", catId, { shouldValidate: true, shouldDirty: true });
            }}
          />

          {/* 1-Tap Category Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <span>Danh mục</span>
                <span className="text-rose-500 font-bold">*</span>
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
                          : selectedType === "income"
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-2xs ring-2 ring-emerald-400/30 font-semibold"
                          : "border-blue-400 bg-blue-50 text-blue-800 shadow-2xs ring-2 ring-blue-400/30 font-semibold"
                        : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80"
                    )}
                  >
                    <span className="shrink-0 text-sm sm:text-base">{emoji}</span>
                    <span className="truncate flex-1">{cat.name}</span>
                    {isSelected && <Check className="h-3 w-3 shrink-0 text-current" />}
                  </button>
                );
              })}

              {/* View all categories trigger chip */}
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-2 text-xs font-medium text-slate-500 transition-all hover:border-slate-400 hover:bg-slate-100/70 active:scale-[0.98]"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Khác...</span>
              </button>
            </div>

            {form.formState.errors.category_id && (
              <p className="text-xs font-medium text-rose-500">
                {form.formState.errors.category_id.message}
              </p>
            )}

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

          {/* Account & Date in a sleek compact layout */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Account Selector */}
            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs font-semibold text-slate-700">Tài khoản thanh toán</FormLabel>
                    <button
                      type="button"
                      onClick={() => setShowCurrencySelect((v) => !v)}
                      className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                    >
                      {currency} ▾
                    </button>
                  </div>
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={(val) => {
                      const nextVal = val === "none" ? null : val;
                      field.onChange(nextVal);
                      const found = accounts.find((a) => a.id === nextVal);
                      if (found?.currency) {
                        form.setValue("currency", found.currency);
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm">
                      <div className="flex items-center gap-2 truncate">
                        <CreditCard className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <SelectValue placeholder="Chọn tài khoản" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id} className="text-xs sm:text-sm">
                          <span className="font-medium">{acc.name}</span>{" "}
                          <span className="text-xs text-muted-foreground">({acc.currency})</span>
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

            {/* Compact Date Picker */}
            <CashflowDateFields control={form.control} />
          </div>

          {/* Optional Currency Override Drawer/Selector if user clicked currency pill */}
          {showCurrencySelect && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 animate-in fade-in slide-in-from-top-1 duration-150 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Chọn loại tiền tệ</span>
                <button
                  type="button"
                  onClick={() => setShowCurrencySelect(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Select value={field.value ?? CUSTOM_CURRENCY} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9 rounded-xl bg-white border-slate-200 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr} value={curr} className="text-xs">
                            {curr}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_CURRENCY} className="text-xs">
                          Tùy chỉnh khác...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {field.value && !CURRENCIES.includes(field.value) ? (
                      <Input
                        className="h-9 rounded-xl text-xs bg-white border-slate-200"
                        value={customCurrency}
                        onChange={(e) => {
                          setCustomCurrency(e.target.value);
                          field.onChange(e.target.value.toUpperCase());
                        }}
                        placeholder="Nhập mã tiền tệ (vd: KRW)"
                      />
                    ) : null}
                  </div>
                )}
              />
            </div>
          )}

          {/* Debt Expense Mode Selector (Chi từ tiền vay vs Mua hộ / Cho vay) */}
          {selectedType === "expense" && (
            <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">Mục đích / Nguồn chi</Label>
                {debtMode !== "none" && (
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      debtMode === "borrowed_spent" ? "text-amber-700" : "text-sky-700"
                    )}
                  >
                    {debtMode === "borrowed_spent" ? "⚡ Cần trả lại tiền" : "⚡ Cần thu lại tiền"}
                  </span>
                )}
              </div>

              {/* Segmented Option Control */}
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-200/70 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDebtMode("none")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-lg py-1.5 font-medium transition active:scale-95",
                    debtMode === "none"
                      ? "bg-white text-slate-800 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <User className="h-3 w-3" />
                  <span>Cá nhân</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDebtMode("borrowed_spent")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-lg py-1.5 font-medium transition active:scale-95",
                    debtMode === "borrowed_spent"
                      ? "bg-amber-600 text-white shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-amber-800"
                  )}
                >
                  <HandCoins className="h-3 w-3" />
                  <span className="truncate">Chi từ vay</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDebtMode("lent_spent")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-lg py-1.5 font-medium transition active:scale-95",
                    debtMode === "lent_spent"
                      ? "bg-sky-600 text-white shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-sky-800"
                  )}
                >
                  <ShoppingBag className="h-3 w-3" />
                  <span className="truncate">Mua hộ / Cho vay</span>
                </button>
              </div>

              {/* Detail box when special mode selected */}
              {debtMode !== "none" && (
                <div
                  className={cn(
                    "space-y-2 rounded-xl border p-2.5 animate-in fade-in slide-in-from-top-1 duration-150",
                    debtMode === "borrowed_spent"
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-sky-200 bg-sky-50/70"
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {debtMode === "borrowed_spent"
                        ? "Vay tiền từ ai? (Người / Bên cho vay)"
                        : "Mua hộ cho ai? (Người / Bên cần thu lại)"}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        debtMode === "borrowed_spent" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"
                      )}
                    >
                      {debtMode === "borrowed_spent" ? "Cần trả lại" : "Cần thu lại"}
                    </span>
                  </div>

                  {/* Suggestion Chips from existing debt partners */}
                  {partners.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-slate-400">Gợi ý:</span>
                      {partners.slice(0, 6).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setDebtPartnerName(p.name)}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-medium transition active:scale-95",
                            debtPartnerName === p.name
                              ? debtMode === "borrowed_spent"
                                ? "bg-amber-600 text-white font-semibold"
                                : "bg-sky-600 text-white font-semibold"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <Input
                    value={debtPartnerName}
                    onChange={(e) => setDebtPartnerName(e.target.value)}
                    placeholder={
                      debtMode === "borrowed_spent"
                        ? "Nhập tên người/bên cho vay (vd: Nam, Vietcombank...)"
                        : "Nhập tên người được mua hộ (vd: Lan, Huy, Team Ăn Trưa...)"
                    }
                    className="h-8.5 rounded-lg border-slate-200 bg-white text-xs"
                  />

                  <p className="text-[11px] text-slate-500 italic">
                    {debtMode === "borrowed_spent"
                      ? "Khoản này sẽ được theo dõi trong danh sách 'Chi từ tiền vay' để bạn nhớ trả lại."
                      : "Khoản này sẽ được theo dõi trong danh sách 'Chi mua hộ' để bạn nhớ thu lại tiền."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Note Input */}
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-semibold text-slate-700">Ghi chú (tùy chọn)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <PenLine className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="vd: Cà phê sáng, ăn trưa, đổ xăng..."
                      className="h-10 rounded-xl border-slate-200 bg-white pl-8.5 pr-3 text-xs sm:text-sm"
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-xs text-rose-500 font-medium">
                  {form.formState.errors.note?.message}
                </FormMessage>
              </FormItem>
            )}
          />

          {submitError ? <p className="text-xs font-medium text-rose-500">{submitError}</p> : null}
        </form>
      </Form>

      {/* Docked Submit Action Bar on Mobile - Snuggly positioned right above bottom nav bar (no 125px gap) */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] z-20 border-t border-slate-200/90 bg-white/95 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.07)] backdrop-blur-xl md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <div className="mx-auto max-w-2xl">
          <Button
            type="submit"
            form="cashflow-form"
            disabled={!canSubmit}
            className={cn(
              "h-12 w-full rounded-2xl text-sm sm:text-base font-semibold shadow-sm transition-all duration-200",
              canSubmit
                ? selectedType === "expense"
                  ? "bg-rose-600 text-white shadow-rose-600/25 hover:bg-rose-700 active:scale-[0.99]"
                  : selectedType === "income"
                  ? "bg-emerald-600 text-white shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.99]"
                  : "bg-blue-600 text-white shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.99]"
                : "cursor-not-allowed bg-slate-200 text-slate-400 hover:bg-slate-200 shadow-none border-0"
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                Đang lưu...
              </span>
            ) : !isValidAmount ? (
              <span>Nhập số tiền để tiếp tục</span>
            ) : !hasCategory ? (
              <span>Chọn danh mục để tiếp tục</span>
            ) : !hasAccount ? (
              <span>Chọn tài khoản thanh toán</span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <span>
                  Thêm{" "}
                  {selectedType === "expense"
                    ? debtMode === "borrowed_spent"
                      ? "chi từ tiền vay"
                      : debtMode === "lent_spent"
                      ? "chi mua hộ / cho vay"
                      : "chi tiêu"
                    : selectedType === "income"
                    ? "thu nhập"
                    : "chuyển khoản"}
                </span>
                <span className="font-bold opacity-90">
                  • {Number(amount).toLocaleString("vi-VN")} {currency}
                </span>
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  if (useDialog) {
    return (
      <>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent
            className="w-full max-w-lg"
            style={{ maxHeight: dialogMaxHeight ? `${dialogMaxHeight}px` : undefined }}
          >
            <DialogHeader>
              <DialogTitle>Thêm giao dịch</DialogTitle>
              <DialogDescription>Ghi chép giao dịch tài chính nhanh chóng</DialogDescription>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
        <Button onClick={() => setDialogOpen(true)} disabled={isSubmitting}>
          Thêm giao dịch
        </Button>
      </>
    );
  }

  return formContent;
}
