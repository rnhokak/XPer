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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cashflowQuickAddSchema, type CashflowQuickAddValues } from "@/lib/validation/cashflow";
import { useQueryClient } from "@tanstack/react-query";
import { cashflowTransactionsQueryKey, type CashflowTransaction } from "@/hooks/useCashflowTransactions";
import { normalizeCashflowRange, rangeStart } from "@/lib/cashflow/utils";
import { useNotificationsStore } from "@/store/notifications";

type Category = { id: string; name: string; type: "income" | "expense" };
type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };

type Props = {
  categories: Category[];
  accounts: Account[];
  defaultAccountId?: string | null;
  defaultCurrency: string;
  useDialog?: boolean;
  range: string;
};

const AUTO_VALUE = "__auto__";
const CUSTOM_CURRENCY = "__custom__";
const CURRENCIES = ["VND", "USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD", "CNY"];
const lastCategoryKey = (type: "income" | "expense") => `cashflow:lastCategory:${type}`;
const toLocalInput = (input: string | Date) => {
  const date = input instanceof Date ? input : new Date(input);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const toIsoStringWithOffset = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
const defaultDateTimeValue = () => toLocalInput(new Date());
const timePresets = [
  { label: "Now", minutes: 0 },
  { label: "-1h", minutes: -60 },
  { label: "-1d", minutes: -1440 },
  { label: "-1w", minutes: -10080 },
];

export function CashflowQuickAddForm({ categories, accounts, defaultAccountId, defaultCurrency, useDialog = false, range }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customCurrency, setCustomCurrency] = useState("");
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [autoThousand, setAutoThousand] = useState(defaultCurrency === "VND");
  const [recentAmounts, setRecentAmounts] = useState<Array<{ amount: number; ts: number }>>([]);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<CashflowQuickAddValues>({
    resolver: zodResolver(cashflowQuickAddSchema),
    defaultValues: {
      type: "expense",
      amount: undefined,
      account_id: defaultAccountId ?? null,
      category_id: null,
      note: "",
      transaction_time: defaultDateTimeValue(),
      currency: defaultCurrency,
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

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
    form.setValue("account_id", defaultAccountId ?? null);
    form.setValue("currency", defaultCurrency);
    setAutoThousand(defaultCurrency === "VND");
  }, [defaultAccountId, defaultCurrency, form]);

  const selectedType = useWatch({ control: form.control, name: "type" }) ?? "expense";
  const selectedCategoryId = useWatch({ control: form.control, name: "category_id" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const transactionTime = useWatch({ control: form.control, name: "transaction_time" });
  const currency = useWatch({ control: form.control, name: "currency" }) ?? defaultCurrency;

  useEffect(() => {
    loadRecentAmounts(currency);
    setAutoThousand(currency === "VND");
  }, [currency]);
  const quickCategories = useMemo(
    () => categories.filter((c) => c.type === selectedType).slice(0, 8),
    [categories, selectedType]
  );

  // Suggest the last used category for the current type when the user hasn't interacted yet
  useEffect(() => {
    if (userTouchedCategory) return;
    if (selectedCategoryId) return;
    try {
      const stored = localStorage.getItem(lastCategoryKey(selectedType));
      if (stored && categories.some((c) => c.id === stored && c.type === selectedType)) {
        form.setValue("category_id", stored);
        setSuggestedCategoryId(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, [categories, form, selectedCategoryId, selectedType, userTouchedCategory]);

  useEffect(() => {
    if (userTouchedCategory) return;
    const acctType = accounts.find((a) => a.id === accountId)?.type?.toLowerCase() ?? "";
    const hour = transactionTime ? new Date(transactionTime).getHours() : new Date().getHours();
    const findCat = (names: string[]) =>
      categories.find(
        (c) => c.type === selectedType && names.some((name) => c.name.toLowerCase().includes(name.toLowerCase()))
      );

    let candidate: string | null = null;
    if (selectedType === "expense") {
      if (typeof amount === "number" && amount <= 50000) {
        candidate = findCat(["coffee"])?.id ?? null;
      } else if (typeof amount === "number" && amount <= 150000 && hour >= 10 && hour <= 14) {
        candidate = findCat(["lunch", "meal"])?.id ?? null;
      } else if (typeof amount === "number" && amount <= 80000 && acctType.includes("wallet")) {
        candidate = findCat(["ride", "grab"])?.id ?? null;
      }
    } else {
      if (typeof amount === "number" && amount >= 10000000) {
        candidate = findCat(["salary"])?.id ?? null;
      } else if (typeof amount === "number" && amount >= 1000000) {
        candidate = findCat(["bonus"])?.id ?? null;
      } else {
        candidate = findCat(["gift"])?.id ?? candidate;
      }
    }

    if (candidate && candidate !== selectedCategoryId) {
      form.setValue("category_id", candidate);
      setSuggestedCategoryId(candidate);
    } else if (!candidate) {
      setSuggestedCategoryId(null);
    }
  }, [amount, accountId, transactionTime, selectedType, categories, accounts, form, userTouchedCategory, selectedCategoryId]);

  const notify = useNotificationsStore((state) => state.notify);

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

    const res = await fetch("/api/cashflow/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseBody = (await res.json().catch(() => null)) as CashflowTransaction | { error?: string } | null;
    if (!res.ok || !responseBody || Array.isArray(responseBody) || !("id" in responseBody)) {
      const message = (responseBody as { error?: string } | null)?.error ?? "Failed to add transaction";
      setSubmitError(message);
      notify({
        title: "Error",
        description: message,
        type: "error",
      });
      return;
    }
    const response = responseBody as CashflowTransaction;

    const normalizedRange = normalizeCashflowRange(range);
    const startFilter = rangeStart(normalizedRange === "all" ? null : normalizedRange);
    const transactionDate = new Date(response.transaction_time);
    if (!Number.isNaN(transactionDate.getTime()) && (!startFilter || transactionDate >= startFilter)) {
      queryClient.setQueryData<CashflowTransaction[]>(cashflowTransactionsQueryKey(range), (prev) => {
        const existing = (prev ?? []).filter((tx) => tx.id !== response.id);
        const next = [response, ...existing];
        return next.slice(0, 50);
      });
    }
    queryClient.invalidateQueries({ queryKey: ["cashflow-transactions"] });

    form.reset({
      type: values.type,
      amount: undefined,
      account_id: payload.account_id,
      category_id: null,
      note: "",
      transaction_time: defaultDateTimeValue(),
      currency: defaultCurrency,
    });
    setAmountInput("");
    try {
      if (payload.category_id) {
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
  };

  const normalizeAmount = (raw: string) => {
    const clean = raw.replace(/,/g, ".").replace(/\s+/g, "");
    if (!clean || clean === "." || clean === "-") return undefined;
    const val = Number(clean.startsWith(".") ? `0${clean}` : clean);
    return Number.isFinite(val) ? val : undefined;
  };

  const applyThousandShortcuts = (raw: string) => {
    const trimmed = raw.trim();
    if (!autoThousand || currency !== "VND") return trimmed;
    if (/^\d{1,3}$/.test(trimmed) && trimmed.length <= 3) {
      // e.g. "50" -> 50000 for VND
      return `${trimmed}000`;
    }
    return trimmed;
  };

  const formatSuggestedLabel = (value: number) => {
    if (currency === "VND") return `${Math.round(value / 1000)}k`;
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
  };

  const suggestedAmounts = useMemo(() => {
    const sorted: Array<{ label: string; value: number | null }> = recentAmounts
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .map((item) => ({ label: formatSuggestedLabel(item.amount), value: item.amount }))
      .slice(0, 4);
    if (currency === "VND") {
      sorted.push({ label: "+000", value: null }); // special: append 000 to current
    }
    return sorted;
  }, [recentAmounts, currency]);

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
      setRecentAmounts(merged);
    } catch {
      // ignore storage errors
    }
  };

  const loadRecentAmounts = (curr: string) => {
    const key = `cashflow:recentAmounts:${curr}`;
    try {
      const raw = localStorage.getItem(key);
      const parsed: Array<{ amount: number; ts: number }> = raw ? JSON.parse(raw) : [];
      setRecentAmounts(parsed);
    } catch {
      setRecentAmounts([]);
    }
  };

  useEffect(() => {
    loadRecentAmounts(currency);
    setAutoThousand(currency === "VND");
  }, [currency]);

  const dialogMaxHeight = useDialog && viewportHeight ? Math.max(360, viewportHeight - 32) : null;

  const formContent = !mounted ? (
    <div className="space-y-3">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="h-10 w-full animate-pulse rounded bg-muted" />
      <div className="h-10 w-full animate-pulse rounded bg-muted" />
      <div className="h-24 w-full animate-pulse rounded bg-muted" />
    </div>
  ) : (
    <div className="space-y-4">
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-white px-3 py-2 shadow-sm ring-1 ring-emerald-100/70">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-700">Quick add</p>
          <p className="text-sm text-muted-foreground">Nhập tiền nhanh, tối ưu cho điện thoại.</p>
        </div>
        <div className="inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
          {selectedType === "income" ? "Income" : "Expense"}
        </div>
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex gap-2">
            {(["expense", "income"] as const).map((type) => (
              <Button
                key={type}
                type="button"
                variant={selectedType === type ? "default" : "outline"}
                className="flex-1"
                onClick={() => form.setValue("type", type)}
              >
                {type === "expense" ? "Expense" : "Income"}
              </Button>
            ))}
          </div>

          <FormField
            control={form.control}
            name="transaction_time"
            render={({ field }) => {
              const nowLocal = defaultDateTimeValue();
              const adjustMinutes = (minutes: number) => {
                const base = field.value ? new Date(field.value) : new Date();
                base.setMinutes(base.getMinutes() + minutes);
                const now = new Date();
                const clamped = base > now ? now : base;
                field.onChange(toLocalInput(clamped));
              };
              return (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Transaction time</FormLabel>
                  <FormControl>
                    <div className="space-y-2 rounded-xl border bg-white/70 p-3 shadow-sm">
                      <div className="flex flex-wrap gap-2">
                        {timePresets.map((preset) => {
                          const presetDate = new Date();
                          presetDate.setMinutes(presetDate.getMinutes() + preset.minutes);
                          const presetInput = toLocalInput(presetDate);
                          const isActive = field.value && Math.abs(new Date(field.value).getTime() - presetDate.getTime()) < 60 * 1000;
                          return (
                            <Button
                              key={preset.label}
                              type="button"
                              size="sm"
                              variant={isActive ? "default" : "outline"}
                              className={`rounded-full px-3 ${isActive ? "bg-foreground text-white hover:bg-foreground" : "bg-white"}`}
                              onClick={() => field.onChange(presetInput)}
                            >
                              {preset.label}
                            </Button>
                          );
                        })}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full px-3"
                            onClick={() => adjustMinutes(-1440)}
                          >
                            -1d
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full px-3"
                            onClick={() => adjustMinutes(1440)}
                          >
                            +1d
                          </Button>
                        </div>
                      </div>
                      <Input
                        type="datetime-local"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const parsed = val ? new Date(val) : null;
                          const now = new Date();
                          if (parsed && parsed > now) {
                            const clamped = toLocalInput(now);
                            field.onChange(clamped);
                            setAmountInput((prev) => prev); // keep amount untouched
                            return;
                          }
                          field.onChange(val);
                        }}
                        max={nowLocal}
                        placeholder="Now by default"
                      />
                    </div>
                  </FormControl>
                  <FormMessage>{form.formState.errors.transaction_time?.message}</FormMessage>
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold">Amount *</FormLabel>
                <FormControl>
                  <div className="space-y-2 rounded-2xl border bg-slate-50/70 p-3 shadow-inner">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,110px]">
                      <Input
                        type="text"
                        inputMode="decimal"
                        className="text-lg h-12 rounded-xl px-3 w-full"
                        value={amountInput}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setAmountInput(raw);
                          const normalized = normalizeAmount(applyThousandShortcuts(raw));
                          field.onChange(normalized);
                        }}
                        onBlur={(e) => {
                          const normalized = normalizeAmount(applyThousandShortcuts(e.target.value));
                          setAmountInput(normalized !== undefined ? String(normalized) : "");
                          field.onChange(normalized);
                        }}
                        placeholder="e.g. 120000"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl w-full"
                          onClick={() => {
                            setAmountInput("");
                            field.onChange(undefined);
                          }}
                        >
                          Clear
                        </Button>
                        {currency === "VND" ? (
                          <Button
                            type="button"
                            variant={autoThousand ? "default" : "outline"}
                            size="sm"
                            className="rounded-xl w-full"
                            onClick={() => setAutoThousand((v) => !v)}
                          >
                            {autoThousand ? "Auto 000" : "No 000"}
                          </Button>
                        ) : (
                          <div className="text-[11px] text-muted-foreground flex items-center justify-center w-full">
                            Currency: {currency}
                          </div>
                        )}
                      </div>
                    </div>
                    {suggestedAmounts.length ? (
                      <div className="flex flex-wrap gap-2">
                        {suggestedAmounts.map((item) => (
                          <Button
                            key={item.label}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full px-3 text-xs"
                            onClick={() => {
                              if (item.value === null) {
                                const appended = `${(amountInput || "0").replace(/\D/g, "")}000`;
                                setAmountInput(appended);
                                const normalized = normalizeAmount(appended);
                                field.onChange(normalized);
                                return;
                              }
                              setAmountInput(String(item.value));
                              field.onChange(item.value);
                            }}
                          >
                            {item.label}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </FormControl>
                <FormMessage>{form.formState.errors.amount?.message}</FormMessage>
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Category (optional)</Label>
            {quickCategories.length ? (
              <div className="flex flex-wrap gap-2">
                {quickCategories.map((cat) => {
                  const active = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`rounded-full px-3 py-1 text-sm font-semibold shadow-sm ring-1 transition ${
                        active ? "bg-foreground text-white ring-foreground" : "bg-white text-foreground ring-black/10"
                      }`}
                      onClick={() => {
                        setUserTouchedCategory(true);
                        form.setValue("category_id", active ? null : cat.id);
                      }}
                    >
                      {cat.name}
                      {suggestedCategoryId === cat.id && !active ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">Suggested</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Chưa có category. Thêm tại <a className="underline" href="/cashflow/categories">Cashflow &gt; Categories</a>.
              </p>
            )}
          </div>

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Quick note..."
                    className="min-h-[64px]"
                  />
                </FormControl>
                <FormMessage>{form.formState.errors.note?.message}</FormMessage>
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <button
              type="button"
              className="text-sm font-semibold text-primary"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? "Ẩn nâng cao" : "Thêm nâng cao (account, ngày)"}
            </button>
            {showAdvanced ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account (optional)</FormLabel>
                      <Select
                        value={field.value ?? AUTO_VALUE}
                        onValueChange={(val) => field.onChange(val === AUTO_VALUE ? null : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Auto select default" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={AUTO_VALUE}>Auto (default)</SelectItem>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name} · {acc.currency}
                              {acc.is_default ? " (default)" : ""}
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
                      <Select
                        value={CURRENCIES.includes(field.value ?? defaultCurrency) ? field.value ?? defaultCurrency : CUSTOM_CURRENCY}
                        onValueChange={(v) => {
                          if (v === CUSTOM_CURRENCY) {
                            const next = customCurrency || "";
                            field.onChange(next);
                            return;
                          }
                          field.onChange(v);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn tiền tệ" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_CURRENCY}>Khác (nhập tay)</SelectItem>
                        </SelectContent>
                      </Select>
                      {!CURRENCIES.includes(field.value ?? "") ? (
                        <FormControl>
                          <Input
                            className="mt-2"
                            value={field.value ?? ""}
                            onChange={(e) => {
                              setCustomCurrency(e.target.value);
                              field.onChange(e.target.value);
                            }}
                            placeholder="Nhập mã tiền tệ (VD: CHF)"
                          />
                        </FormControl>
                      ) : null}
                      <FormMessage>{form.formState.errors.currency?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
            ) : null}
          </div>

          {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Add transaction"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                form.reset({
                  type: form.getValues("type"),
                  amount: undefined,
                  account_id: defaultAccountId ?? null,
                  category_id: null,
                  note: "",
                  transaction_time: defaultDateTimeValue(),
                  currency: defaultCurrency,
                });
              }}
            >
              Clear
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );

  if (useDialog) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button size="lg">Quick add</Button>
        </DialogTrigger>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
          style={dialogMaxHeight ? { maxHeight: `${dialogMaxHeight}px` } : undefined}
        >
          <DialogHeader>
            <DialogTitle>Thêm giao dịch nhanh</DialogTitle>
            <DialogDescription>Nhập số tiền và các trường tuỳ chọn.</DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  return <div className="rounded-xl border bg-white p-4 shadow-sm">{formContent}</div>;
}
