"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cashflowQuickAddSchema, type CashflowQuickAddValues } from "@/lib/validation/cashflow";

type Category = { id: string; name: string; type: "income" | "expense" };
type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };

type Props = {
  categories: Category[];
  accounts: Account[];
  defaultAccountId?: string | null;
  defaultCurrency: string;
  useDialog?: boolean;
};

const defaultDateTimeValue = () => new Date().toISOString().slice(0, 16);
const AUTO_VALUE = "__auto__";
const CUSTOM_CURRENCY = "__custom__";
const CURRENCIES = ["VND", "USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD", "CNY"];
const lastCategoryKey = (type: "income" | "expense") => `cashflow:lastCategory:${type}`;

export function CashflowQuickAddForm({ categories, accounts, defaultAccountId, defaultCurrency, useDialog = false }: Props) {
  const router = useRouter();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customCurrency, setCustomCurrency] = useState("");
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    form.setValue("account_id", defaultAccountId ?? null);
    form.setValue("currency", defaultCurrency);
  }, [defaultAccountId, defaultCurrency, form]);

  const selectedType = useWatch({ control: form.control, name: "type" }) ?? "expense";
  const selectedCategoryId = useWatch({ control: form.control, name: "category_id" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const transactionTime = useWatch({ control: form.control, name: "transaction_time" });
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

  const onSubmit = async (values: CashflowQuickAddValues) => {
    setSubmitError(null);
    const payload = {
      ...values,
      category_id: values.category_id || null,
      account_id: values.account_id || defaultAccountId || null,
      transaction_time: values.transaction_time || undefined,
      currency: values.currency || defaultCurrency,
    };

    const res = await fetch("/api/cashflow/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      setSubmitError(error.error ?? "Failed to add transaction");
      return;
    }

    form.reset({
      type: values.type,
      amount: undefined,
      account_id: payload.account_id,
      category_id: null,
      note: "",
      transaction_time: defaultDateTimeValue(),
      currency: defaultCurrency,
    });
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
    router.refresh();
  };

  const formContent = !mounted ? (
    <div className="space-y-3">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="h-10 w-full animate-pulse rounded bg-muted" />
      <div className="h-10 w-full animate-pulse rounded bg-muted" />
      <div className="h-24 w-full animate-pulse rounded bg-muted" />
    </div>
  ) : (
    <div className="space-y-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Quick add</p>
          <p className="text-sm text-muted-foreground">Chỉ cần nhập số tiền, mọi thứ khác là tuỳ chọn.</p>
        </div>
        <div className="inline-flex rounded-full bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
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
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold">Amount *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    className="text-lg"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                    placeholder="e.g. 120000"
                  />
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
                  name="transaction_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || "")}
                          placeholder="Now by default"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.transaction_time?.message}</FormMessage>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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
