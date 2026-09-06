"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  cashflowQuickAddSchema,
  cashflowTransactionTypeLabels,
  cashflowTransactionTypes,
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

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer" | "debt";
  parent_id: string | null;
  category_focus: CategoryFocus | null;
};
type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };

type Props = {
  categories: Category[];
  accounts: Account[];
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

export function CashflowQuickAddForm({ categories, accounts, defaultAccountId, defaultCurrency, useDialog = false, range, isLoading = false }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customCurrency, setCustomCurrency] = useState("");
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [lastTransactionTime, setLastTransactionTime] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const queryClient = useQueryClient();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<Array<{ category: Category; reason?: string }>>([]);

  const form = useForm<CashflowQuickAddValues>({
    resolver: zodResolver(cashflowQuickAddSchema),
    defaultValues: {
      type: "expense",
      amount: undefined,
      account_id: defaultAccountId ?? null,
      category_id: null,
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
  const transactionTime = useWatch({ control: form.control, name: "transaction_time" });
  const currency = useWatch({ control: form.control, name: "currency" }) ?? defaultCurrency;

  const categoriesByType = useMemo(() => categories.filter((c) => c.type === selectedType), [categories, selectedType]);
  const { data: reportTransactions = [] } = useCashflowReportTransactions();

  const popularRecentCategories = useMemo(() => {
    const counts = new Map<string, { category: Category; count: number }>();

    [...reportTransactions]
      .filter((tx) => tx.type === selectedType && tx.category?.id)
      .sort((a, b) => new Date(b.transaction_time).getTime() - new Date(a.transaction_time).getTime())
      .slice(0, 30)
      .forEach((tx) => {
        const categoryId = tx.category?.id;
        if (!categoryId) return;
        const category = categories.find((c) => c.id === categoryId && c.type === selectedType);
        if (!category) return;

        const existing = counts.get(categoryId) ?? { category, count: 0 };
        existing.count += 1;
        counts.set(categoryId, existing);
      });

    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.category.name.localeCompare(b.category.name))
      .slice(0, 5)
      .map(({ category, count }) => ({
        category,
        reason: count > 1 ? `${count}x gần đây` : "Gần đây",
      }));
  }, [categories, reportTransactions, selectedType]);

  useEffect(() => {
    const suggestions: Array<{ category: Category; reason?: string }> = [];
    const seen = new Set<string>();

    const addSuggestion = (category?: Category, reason?: string) => {
      if (!category || seen.has(category.id)) return;
      seen.add(category.id);
      suggestions.push({ category, reason });
    };

    popularRecentCategories.forEach((item) => addSuggestion(item.category, item.reason));

    const storedId = (() => {
      try {
        return localStorage.getItem(lastCategoryKey(selectedType));
      } catch {
        return null;
      }
    })();

    if (storedId) {
      const storedCategory = categories.find((c) => c.id === storedId && c.type === selectedType);
      if (storedCategory) {
        addSuggestion(storedCategory, "Last used");
      }
    }
   
    if (suggestions.length < 5) {
      categoriesByType
        .filter((category) => !seen.has(category.id))
        .slice(0, 5 - suggestions.length)
        .forEach((category) => addSuggestion(category));
    }

    setSmartSuggestions(suggestions.slice(0, 5));

    if (userTouchedCategory) {
      return;
    }

    const autoId = suggestions[0]?.category?.id ?? null;
    if (autoId) {
      form.setValue("category_id", autoId);
      setSuggestedCategoryId(autoId);
    } else {
      setSuggestedCategoryId(null);
    }
  }, [amount, accounts, accountId, categories, categoriesByType, form, popularRecentCategories, selectedCategoryId, selectedType, transactionTime, userTouchedCategory]);

  const notify = useNotificationsStore((state) => state.notify);
  const createMutation = useCreateTransaction();
  const isSubmitting = createMutation.isPending && isOnline;

  const onSubmit = async (values: CashflowQuickAddValues) => {
    setSubmitError(null);
    const transactionTimeIso = toIsoStringWithOffset(values.transaction_time);
    const payload = {
      ...values,
      category_id: values.category_id || null,
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
          category_id: null,
          note: "",
          transaction_time: nextTransactionTime,
          currency: defaultCurrency,
        });
        setUserTouchedCategory(false);
        setSuggestedCategoryId(null);
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
          title: "Success",
          description: "Transaction added successfully!",
          type: "success",
        });
      },
      onError: (error) => {
        const message = error.message || "Failed to add transaction";
        setSubmitError(message);
        notify({
          title: "Error",
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
      const merged = [
        { amount: value, ts: now },
        ...existing.filter((item) => item.amount !== value),
      ].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(merged));
    } catch {
      // ignore storage errors
    }
  };

  const dialogMaxHeight = useDialog && viewportHeight ? Math.max(360, viewportHeight - 32) : null;

  const formContent = isLoading ? (
    <div className="space-y-3 pb-24 sm:pb-0">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="h-10 w-full animate-pulse rounded bg-muted" />
      <div className="h-10 w-full animate-pulse rounded bg-muted" />
      <div className="h-24 w-full animate-pulse rounded bg-muted" />
    </div>
  ) : (
    <div className="space-y-4  sm:pb-0">
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-white px-3 py-2 shadow-sm ring-1 ring-emerald-100/70">
        <div className="inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
          {cashflowTransactionTypeLabels[selectedType]}
        </div>
      </div>

      <Form {...form}>
        <form id="form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex gap-2">
            {cashflowTransactionTypes.map((type) => (
              <Button
                key={type}
                type="button"
                variant={selectedType === type ? "default" : "outline"}
                className="flex-1"
                onClick={() => form.setValue("type", type)}
              >
                {cashflowTransactionTypeLabels[type]}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            <CashflowDateFields control={form.control} />
            <CashflowAmountFields control={form.control} currency={currency} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Category (optional)</Label>
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/60"
            >
              <span className="truncate">
                {selectedCategoryId
                  ? categories.find((cat) => cat.id === selectedCategoryId)?.name
                  : "Select category"}
              </span>
              <span className="text-xs text-muted-foreground">Choose</span>
            </button>
            {suggestedCategoryId && selectedCategoryId !== suggestedCategoryId ? (
              <p className="text-[10px] text-primary">
                Suggested: {categories.find((cat) => cat.id === suggestedCategoryId)?.name}
              </p>
            ) : null}
            <CategoryTreeModal
              open={categoryModalOpen}
              onClose={() => setCategoryModalOpen(false)}
              categories={categoriesByType}
              selected={selectedCategoryId ?? null}
              onSelect={(next) => {
                form.setValue("category_id", next);
                setUserTouchedCategory(true);
                setSuggestedCategoryId(next);
              }}
              suggestedId={suggestedCategoryId}
            />
            {smartSuggestions.length ? (
              <div className="space-y-2 rounded-2xl border border-dashed border-primary/60 bg-primary/5 p-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>Smart suggestions</span>
                  <span>Amount & time</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {smartSuggestions.map(({ category }) => {
                    const active = selectedCategoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition duration-150 ${
                          active
                            ? "bg-foreground text-white border-foreground"
                            : "border border-gray-200 bg-white text-foreground hover:border-primary/60"
                        }`}
                        onClick={() => {
                          form.setValue("category_id", category.id);
                          setUserTouchedCategory(true);
                          setSuggestedCategoryId(category.id);
                        }}
                      >
                        <div className="min-w-0 flex items-center gap-2 text-sm">
                          <span className="font-semibold truncate">{category.name}</span>
                        </div>
                        {active ? <span className="text-xs font-semibold">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account</FormLabel>
                <Select
                  value={field.value ?? undefined}
                  onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage>{form.formState.errors.account_id?.message}</FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select value={field.value ?? CUSTOM_CURRENCY} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr} value={curr}>
                        {curr}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_CURRENCY}>Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {field.value && !CURRENCIES.includes(field.value) ? (
                  <Input
                    className="mt-2"
                    value={customCurrency}
                    onChange={(e) => {
                      setCustomCurrency(e.target.value);
                      field.onChange(e.target.value.toUpperCase());
                    }}
                    placeholder="Enter custom currency"
                  />
                ) : null}
                <FormMessage>{form.formState.errors.currency?.message}</FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Add a note..."
                    rows={3}
                    className="resize-none"
                  />
                </FormControl>
                <FormMessage>{form.formState.errors.note?.message}</FormMessage>
              </FormItem>
            )}
          />

          {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
        </form>
      </Form>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="submit" form="form" disabled={isSubmitting} className="w-full sm:static" style={{ marginBottom: '125px' }}>
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
              Adding...
            </span>
          ) : (
            "Add Transaction"
          )}
        </Button>
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
              <DialogTitle>Add Transaction</DialogTitle>
              <DialogDescription>Quick add a new cashflow transaction.</DialogDescription>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
        <Button onClick={() => setDialogOpen(true)} disabled={isSubmitting}>
          Add Transaction
        </Button>
      </>
    );
  }

  return formContent;
}
