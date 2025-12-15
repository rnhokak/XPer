"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Fragment, useMemo, useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cashflowQuickAddSchema, type CashflowQuickAddValues } from "@/lib/validation/cashflow";
import { useQueryClient } from "@tanstack/react-query";
import { cashflowTransactionsQueryKey, useCashflowTransactions, type CashflowTransaction } from "@/hooks/useCashflowTransactions";
import { useViewportUnit } from "@/hooks/useViewportUnit";
import { CategoryTreeModal } from "./CategoryTreeModal";

type Transaction = CashflowTransaction;
type Category = { id: string; name: string; type: "income" | "expense"; parent_id: string | null };
type Account = { id: string; name: string; currency: string };

const formatNumber = (value: number, currency?: string) => {
  const isVnd = currency?.toUpperCase() === "VND";
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: isVnd ? 0 : 2,
    minimumFractionDigits: isVnd ? 0 : 2,
  });
};

const formatDateTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

const NONE_VALUE = "__none__";
const lastCategoryKey = (type: "income" | "expense") => `cashflow:lastCategory:${type}`;

// Detect if the device is mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if it's a client-side render and determine if mobile
    const checkIsMobile = () => {
      if (typeof window !== 'undefined') {
        // More precise mobile detection
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        // Also check screen size as a fallback
        const isSmallScreen = window.innerWidth < 768;
        setIsMobile(isMobileDevice || isSmallScreen);
      }
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
}

export function CashflowTransactionList({
  transactions: initialTransactions,
  categories,
  accounts,
  range,
}: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  range: string;
}) {
  const queryClient = useQueryClient();
  const { data: transactions = initialTransactions, isFetching } = useCashflowTransactions(range, initialTransactions);
  const queryKey = cashflowTransactionsQueryKey(range);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<Array<{ category: Category; reason?: string }>>([]);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);

  // Initialize viewport units to handle keyboard appearance
  useViewportUnit();

  // Mobile detection
  const isMobileView = useIsMobile();

  useEffect(() => {
    if (!selected) {
      setConfirmDeleteOpen(false);
    }
  }, [selected]);

  const sorted = useMemo(() => {
    const data = [...transactions].sort((a, b) => {
      const aTime = new Date(a.transaction_time).getTime();
      const bTime = new Date(b.transaction_time).getTime();
      return Number.isNaN(bTime) || Number.isNaN(aTime) ? 0 : bTime - aTime;
    });
    return data;
  }, [transactions]);

  const groupedByDay = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    const formatter = new Intl.DateTimeFormat("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    sorted.forEach((tx) => {
      const key = formatter.format(new Date(tx.transaction_time));
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return groups;
  }, [sorted]);

  const form = useForm<CashflowQuickAddValues>({
    resolver: zodResolver(cashflowQuickAddSchema),
    defaultValues: {
      type: "expense",
      amount: 0,
      account_id: null,
      category_id: null,
      note: "",
      transaction_time: "",
      currency: "VND",
    },
  });

  const selectedType = form.watch("type") ?? "expense";
  const selectedCategoryId = form.watch("category_id");
  const amount = form.watch("amount");
  const accountId = form.watch("account_id");
  const transactionTimeValue = form.watch("transaction_time");
  const categoriesByType = useMemo(() => categories.filter((c) => c.type === selectedType), [categories, selectedType]);

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

    const hour = transactionTimeValue ? new Date(transactionTimeValue).getHours() : new Date().getHours();
    const amountValue = typeof amount === "number" ? amount : null;
    const acctType = accounts.find((a) => a.id === accountId)?.type?.toLowerCase() ?? "";

    const heuristics: Array<{ condition: boolean; keywords: string[]; reason: string }> = [];
    if (selectedType === "expense") {
      heuristics.push(
        { condition: amountValue !== null && amountValue <= 50000, keywords: ["coffee", "cafe"], reason: "Nhỏ, cà phê" },
        { condition: amountValue !== null && amountValue <= 150000 && hour >= 10 && hour <= 14, keywords: ["lunch", "meal"], reason: "Giữa trưa" },
        { condition: amountValue !== null && amountValue <= 80000 && acctType.includes("wallet"), keywords: ["ride", "grab", "taxi"], reason: "Di chuyển ví" }
      );
    } else {
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

    if (selectedCategoryId) {
      setSuggestedCategoryId(selectedCategoryId);
      return;
    }

    const autoId = suggestions[0]?.category?.id ?? null;
    if (autoId) {
      form.setValue("category_id", autoId);
      setSuggestedCategoryId(autoId);
    } else {
      setSuggestedCategoryId(null);
    }
  }, [amount, accounts, accountId, categories, categoriesByType, form, selectedCategoryId, selectedType, transactionTimeValue, userTouchedCategory]);

  const openDetail = (tx: Transaction) => {
    setSubmitError(null);
    setDeleteError(null);
    form.reset({
      type: tx.type,
      amount: tx.amount,
      account_id: tx.account?.id ?? null,
      category_id: tx.category?.id ?? null,
      note: tx.note ?? "",
      transaction_time: toLocalInputValue(tx.transaction_time),
      currency: tx.currency,
    });
    setSelected(tx);
    setUserTouchedCategory(false);
    setSuggestedCategoryId(tx.category?.id ?? null);
  };

  const handleSave = async (values: CashflowQuickAddValues) => {
    if (!selected) return;
    const current = selected;
    setSubmitError(null);
    const normalizedTime = toIsoStringWithOffset(values.transaction_time);
    const payload = {
      ...values,
      category_id: values.category_id || null,
      account_id: values.account_id || null,
      transaction_time: normalizedTime ?? null,
    };

    const res = await fetch("/api/cashflow/transactions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, ...payload }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Cập nhật thất bại");
      return;
    }

    const category = values.category_id ? categories.find((c) => c.id === values.category_id) : null;
    const account = values.account_id ? accounts.find((a) => a.id === values.account_id) : null;
    const normalizedTimeForState = normalizedTime ?? current.transaction_time ?? new Date().toISOString();
    const updatedTx: Transaction = {
      ...current,
      type: payload.type ?? "expense",
      amount: payload.amount,
      currency: payload.currency ?? current.currency,
      note: payload.note ?? null,
      transaction_time: normalizedTimeForState,
      category: category ? { id: category.id, name: category.name, type: category.type } : null,
      account: account ? { id: account.id, name: account.name, currency: account.currency } : null,
    };
    setSelected(null);
    queryClient.setQueryData<Transaction[]>(queryKey, (prev) => (prev ? prev.map((tx) => (tx.id === current.id ? updatedTx : tx)) : prev));
    queryClient.invalidateQueries({ queryKey: ["cashflow-transactions"] });
  };

  const handleDelete = async () => {
    if (!selected) return;
    const current = selected;
    setDeleteError(null);
    setDeleting(true);
    const res = await fetch("/api/cashflow/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id }),
    });
    setDeleting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setDeleteError(err.error ?? "Xoá thất bại");
      return;
    }
    setSelected(null);
    queryClient.setQueryData<Transaction[]>(queryKey, (prev) => prev?.filter((tx) => tx.id !== current.id));
    queryClient.invalidateQueries({ queryKey: ["cashflow-transactions"] });
  };

  const handleConfirmDelete = async () => {
    setConfirmDeleteOpen(false);
    await handleDelete();
  };

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p>;
  }

  return (
    <div className="space-y-3">
      {isFetching ? <p className="text-xs text-muted-foreground">Đang đồng bộ dữ liệu...</p> : null}
      <div className="md:hidden space-y-4">
        {Object.entries(groupedByDay).map(([dayLabel, dayTransactions]) => (
          <div key={dayLabel} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dayLabel}</p>
            {dayTransactions.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => openDetail(tx)}
                className="w-full text-left rounded-lg border bg-white p-3 shadow-sm transition hover:shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{formatDateTime(tx.transaction_time)}</p>
                    <p className="text-sm font-semibold">{tx.category?.name ?? "Uncategorized"}</p>
                    {tx.note ? <p className="text-sm text-muted-foreground">{tx.note}</p> : null}
                  </div>
                  <div className={`money-blur text-base font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                    {formatNumber(tx.amount, tx.currency)} {tx.currency}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`rounded-full px-2 py-1 ${tx.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {tx.type}
                  </span>
                  {tx.account?.name ? <span>{tx.account.name}</span> : null}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedByDay).map(([dayLabel, dayTransactions]) => (
              <Fragment key={dayLabel}>
                <TableRow>
                  <TableCell colSpan={6} className="bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {dayLabel}
                  </TableCell>
                </TableRow>
                {dayTransactions.map((tx) => (
                  <TableRow key={tx.id} className="cursor-pointer" onClick={() => openDetail(tx)}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDateTime(tx.transaction_time)}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          tx.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {tx.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{tx.category?.name ?? "Uncategorized"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.account?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.note ?? "—"}</TableCell>
                    <TableCell className={`money-blur text-right font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                      {formatNumber(tx.amount, tx.currency)} {tx.currency}
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile and desktop friendly transaction detail dialog */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
      <DialogContent 
        className={`max-h-[90vh] overflow-y-auto ${
          isMobileView 
            ? "w-full max-w-[95vw] scale-100" 
            : "max-w-lg"
        }`}
        style={{
          maxHeight: 'calc(var(--full-vh, 100vh) - 2rem)',
        }}
      >
        <DialogHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>Chi tiết giao dịch</DialogTitle>
              <DialogDescription>Xem, sửa hoặc xoá giao dịch.</DialogDescription>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="mr-5"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleting}
            >
              Xoá
            </Button>
          </div>
        </DialogHeader>

          {selected ? (
            <Form {...form}>
              <form className="space-y-3" onSubmit={form.handleSubmit(handleSave)}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loại</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="income">Income</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage>{form.formState.errors.type?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số tiền</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage>{form.formState.errors.amount?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
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
                    selected={selectedCategoryId}
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
                                setSuggestedCategoryId(category.id);
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
                  name="account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account</FormLabel>
                      <Select
                        value={field.value ?? NONE_VALUE}
                        onValueChange={(val) => field.onChange(val === NONE_VALUE ? null : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>None</SelectItem>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name} · {acc.currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage>{form.formState.errors.account_id?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="transaction_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Thời gian</FormLabel>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              className="w-full"
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value)}
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
                        <FormLabel>Tiền tệ</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage>{form.formState.errors.currency?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ghi chú</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.note?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
                {deleteError ? <p className="text-sm text-red-500">{deleteError}</p> : null}

                <DialogFooter className="flex flex-row-reverse gap-2">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                    Đóng
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá</DialogTitle>
            <DialogDescription>Bạn có chắc muốn xoá giao dịch này? Hành động không thể hoàn tác.</DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="mt-2 text-sm text-red-500">{deleteError}</p> : null}
          <DialogFooter className="flex flex-row-reverse gap-2">
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? "Đang xoá..." : "Xoá giao dịch"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
              Huỷ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
