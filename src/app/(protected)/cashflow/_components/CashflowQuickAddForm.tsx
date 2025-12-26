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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  cashflowQuickAddSchema,
  cashflowTransactionTypeLabels,
  cashflowTransactionTypes,
  type CashflowQuickAddValues,
  type CashflowTransactionType,
} from "@/lib/validation/cashflow";
import { useQueryClient } from "@tanstack/react-query";
import { cashflowReportTransactionsQueryKey, cashflowTransactionsQueryKey, type CashflowTransaction } from "@/hooks/useCashflowTransactions";
import { normalizeCashflowRange, rangeStart } from "@/lib/cashflow/utils";
import { type CategoryFocus } from "@/lib/validation/categories";
import { useNotificationsStore } from "@/store/notifications";
import { CategoryTreeModal } from "./CategoryTreeModal";
import Link from "next/link";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
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
};

const AUTO_VALUE = "__auto__";
const CUSTOM_CURRENCY = "__custom__";
const CURRENCIES = ["VND", "USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD", "CNY"];
const lastCategoryKey = (type: CashflowTransactionType) => `cashflow:lastCategory:${type}`;
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

  const categoriesByType = useMemo(() => categories.filter((c) => c.type === selectedType), [categories, selectedType]);
  const CATEGORY_MANAGER_PATH = "/cashflow/categories";

  useEffect(() => {
    const suggestions: Array<{ category: Category; reason?: string }> = [];
    const seen = new Set<string>();

    const addSuggestion = (category?: Category, reason?: string) => {
      if (!category || seen.has(category.id)) return;
      seen.add(category.id);
      suggestions.push({ category, reason });
    };

    const findByKeywords = (names: string[]) => {
      const lowered = names.map((name) => name.toLowerCase());
      return categories.find(
        (c) =>
          c.type === selectedType &&
          lowered.some((name) => c.name.toLowerCase().includes(name))
      );
    };

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

    const hour = transactionTime ? new Date(transactionTime).getHours() : new Date().getHours();
    const amountValue = typeof amount === "number" ? amount : null;
    const acctType = accounts.find((a) => a.id === accountId)?.type?.toLowerCase() ?? "";

    const heuristics: Array<{ condition: boolean; keywords: string[]; reason: string }> = [];
    if (selectedType === "expense") {
      heuristics.push(
        { condition: amountValue !== null && amountValue <= 50000, keywords: ["coffee", "cafe"], reason: "Nhỏ, cà phê" },
        { condition: amountValue !== null && amountValue <= 150000 && hour >= 10 && hour <= 14, keywords: ["lunch", "meal"], reason: "Giữa trưa" },
        { condition: amountValue !== null && amountValue <= 80000 && acctType.includes("wallet"), keywords: ["ride", "grab", "taxi"], reason: "Di chuyển ví" }
      );
    } else if (selectedType === "income") {
      heuristics.push(
        { condition: amountValue !== null && amountValue >= 10000000, keywords: ["salary"], reason: "Lương lớn" },
        { condition: amountValue !== null && amountValue >= 1000000, keywords: ["bonus"], reason: "Bonus" },
        { condition: amountValue !== null && amountValue < 1000000, keywords: ["gift"], reason: "Tiền thưởng" }
      );
    }

    heuristics.forEach((item) => {
      if (!item.condition) return;
      const matched = findByKeywords(item.keywords);
      addSuggestion(matched, item.reason);
    });

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
  }, [amount, accounts, accountId, categories, categoriesByType, form, selectedCategoryId, selectedType, transactionTime, userTouchedCategory]);

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
      queryClient.setQueryData<CashflowTransaction[]>(cashflowReportTransactionsQueryKey, (prev) => {
        const existing = (prev ?? []).filter((tx) => tx.id !== response.id);
        return [response, ...existing];
      });
    }
    queryClient.invalidateQueries({ queryKey: ["cashflow-transactions"] });
    queryClient.invalidateQueries({ queryKey: cashflowReportTransactionsQueryKey });

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
  };

  const evaluateAmountExpression = (raw: string) => {
    const clean = raw.replace(/,/g, ".").replace(/\s+/g, "");
    if (!clean || clean === "." || clean === "-" || clean === "+") return undefined;
    if (!/^[0-9+\-*/.()]+$/.test(clean)) return undefined;
    try {
      const result = new Function(`"use strict"; return (${clean});`)();
      return typeof result === "number" && Number.isFinite(result) ? result : undefined;
    } catch {
      return undefined;
    }
  };

  const normalizeAmount = (raw: string) => evaluateAmountExpression(raw);

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

  const numericInputPattern = /^-?\d*(\.\d*)?$/;

  const formatNumericValue = (value: string) => {
    if (!value || value === "-" || value === "." || value === "-." || value === "+") return value;
    const sign = value.startsWith("-") ? "-" : "";
    const unsigned = sign ? value.slice(1) : value;
    const hasDecimal = unsigned.includes(".");
    const [integerPart = "", decimalPart] = unsigned.split(".");
    const formattedInteger = integerPart
      ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      : hasDecimal
      ? "0"
      : "";
    const decimalSuffix = hasDecimal ? `.${decimalPart ?? ""}` : "";
    return `${sign}${formattedInteger}${decimalSuffix}`;
  };

  const formatInputDisplay = (value: string, fallback?: string) => {
    const cleaned = value.replace(/,/g, "");
    if (!cleaned) return "";
    if (!numericInputPattern.test(cleaned)) {
      return fallback ?? value;
    }
    return formatNumericValue(cleaned);
  };

  const formatNumberForInput = (value: number) => formatNumericValue(String(value));

  const suggestedAmounts = useMemo(() => {
    const seen = new Set<number>();
    const sorted: Array<{ label: string; value: number | null }> = recentAmounts
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .reduce<Array<{ label: string; value: number | null }>>((acc, item) => {
        if (seen.has(item.amount)) {
          return acc;
        }
        seen.add(item.amount);
        acc.push({ label: formatSuggestedLabel(item.amount), value: item.amount });
        return acc;
      }, [])
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
          {cashflowTransactionTypeLabels[selectedType]}
        </div>
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                          const cleaned = raw.replace(/,/g, "");
                          const normalized = normalizeAmount(applyThousandShortcuts(cleaned));
                          field.onChange(normalized);
                          if (!cleaned) {
                            setAmountInput("");
                            return;
                          }
                          setAmountInput(formatInputDisplay(cleaned, raw));
                        }}
                        onBlur={(e) => {
                          const cleaned = e.target.value.replace(/,/g, "");
                          const normalized = normalizeAmount(applyThousandShortcuts(cleaned));
                          setAmountInput(normalized !== undefined ? formatNumberForInput(normalized) : "");
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
                                const numericInput = amountInput.replace(/,/g, "");
                                const appended = `${(numericInput || "0").replace(/\D/g, "")}000`;
                                setAmountInput(formatInputDisplay(appended, appended));
                                const normalized = normalizeAmount(appended);
                                field.onChange(normalized);
                                return;
                              }
                              setAmountInput(formatNumberForInput(item.value));
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
            {categoriesByType.length === 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <p>No {cashflowTransactionTypeLabels[selectedType]} categories yet.</p>
                <Button size="sm" variant="outline" asChild>
                  <Link href={CATEGORY_MANAGER_PATH}>Create category</Link>
                </Button>
              </div>
            ) : null}
            {!selectedCategoryId && categoriesByType.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-center text-[11px] font-semibold"
                asChild
              >
                <Link href={CATEGORY_MANAGER_PATH}>
                  Add {cashflowTransactionTypeLabels[selectedType]} category
                </Link>
              </Button>
            ) : null}
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
                  {smartSuggestions.map(({ category, reason }) => {
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
                        }}
                      >
                        <div className="min-w-0 flex items-center gap-2 text-sm">
                          <span className="font-semibold truncate">{category.name}</span>
                          {reason ? (
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{reason}</span>
                          ) : null}
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
                setUserTouchedCategory(false);
                setSuggestedCategoryId(null);
                setAmountInput("");
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
