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
import {
  cashflowQuickAddSchema,
  cashflowTransactionTypeLabels,
  type CashflowQuickAddValues,
  type CashflowTransactionType,
} from "@/lib/validation/cashflow";
import { type CategoryFocus } from "@/lib/validation/categories";
import { useQueryClient } from "@tanstack/react-query";
import { cashflowTransactionsQueryKey, useCashflowTransactions, type CashflowTransaction, useUpdateTransaction, useDeleteTransaction } from "@/hooks/useCashflowTransactions";
import { CategoryTreeModal } from "./CategoryTreeModal";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parent_id: string | null;
  category_focus: CategoryFocus | null;
};
type Account = { id: string; name: string; currency: string; type?: string | null };

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
const typeBadgeBaseClasses = "rounded-full px-2 py-1 text-xs font-semibold";
const getTypeBadgeClasses = (type: CashflowTransactionType) => {
  if (type === "income") return "bg-emerald-50 text-emerald-700";
  if (type === "transfer") return "bg-slate-100 text-slate-700";
  return "bg-red-50 text-red-700";
};
const getAmountTextClass = (type: CashflowTransactionType) => {
  if (type === "income") return "text-emerald-600";
  if (type === "transfer") return "text-slate-600";
  return "text-red-600";
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      if (typeof window !== 'undefined') {
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
  shift,
}: {
  transactions: CashflowTransaction[];
  categories: Category[];
  accounts: Account[];
  range: string;
  shift: number;
}) {
  const queryClient = useQueryClient();
  const { data: transactions = initialTransactions, isFetching } = useCashflowTransactions(range, shift, initialTransactions);
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const queryKey = cashflowTransactionsQueryKey(range, shift);
  const [selected, setSelected] = useState<CashflowTransaction | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);

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
    const groups: Record<string, CashflowTransaction[]> = {};
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
        return localStorage.getItem(`cashflow:lastCategory:${selectedType}`);
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
  }, [amount, accounts, accountId, categories, categoriesByType, form, selectedCategoryId, selectedType, transactionTimeValue, userTouchedCategory]);

  const openDetail = (tx: CashflowTransaction) => {
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
      transaction_time: normalizedTime || undefined,
    };

    updateMutation.mutate(
      { id: current.id, values: payload },
      {
        onSuccess: () => {
          const category = values.category_id ? categories.find((c) => c.id === values.category_id) : null;
          const account = values.account_id ? accounts.find((a) => a.id === values.account_id) : null;
          const normalizedTimeForState = normalizedTime ?? current.transaction_time ?? new Date().toISOString();
          const updatedTx: CashflowTransaction = {
            ...current,
            type: payload.type ?? "expense",
            amount: payload.amount,
            currency: payload.currency ?? current.currency,
            note: payload.note ?? null,
            transaction_time: normalizedTimeForState,
            category: category ? { id: category.id, name: category.name, type: category.type } : null,
            account: account ? { id: account.id, name: account.name, currency: account.currency } : null,
            user_id: current.user_id,
          };
          setSelected(null);
          queryClient.setQueryData<CashflowTransaction[]>(queryKey, (prev) => (prev ? prev.map((tx) => (tx.id === current.id ? updatedTx : tx)) : prev));
          queryClient.invalidateQueries({ queryKey: ["cashflow-transactions"] });
        },
        onError: (error) => {
          setSubmitError(error.message || "Cập nhật thất bại");
        },
      }
    );
  };

  const handleDelete = async () => {
    if (!selected) return;
    const current = selected;
    setDeleteError(null);
    setDeleting(true);
    
    deleteMutation.mutate(
      current.id,
      {
        onSuccess: () => {
          setSelected(null);
          setDeleting(false);
          queryClient.setQueryData<CashflowTransaction[]>(queryKey, (prev) => prev?.filter((tx) => tx.id !== current.id));
          queryClient.invalidateQueries({ queryKey: ["cashflow-transactions"] });
        },
        onError: (error) => {
          setDeleting(false);
          setDeleteError(error.message || "Xoá thất bại");
        },
      }
    );
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
                  <div className={`money-blur text-base font-semibold ${getAmountTextClass(tx.type)}`}>
                    {formatNumber(tx.amount, tx.currency)} {tx.currency}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`${typeBadgeBaseClasses} ${getTypeBadgeClasses(tx.type)}`}>
                    {cashflowTransactionTypeLabels[tx.type]}
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
                      <span className={`${typeBadgeBaseClasses} ${getTypeBadgeClasses(tx.type)}`}>
                        {cashflowTransactionTypeLabels[tx.type]}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{tx.category?.name ?? "Uncategorized"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.account?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.note ?? "—"}</TableCell>
                    <TableCell className={`money-blur text-right font-semibold ${getAmountTextClass(tx.type)}`}>
                      {formatNumber(tx.amount, tx.currency)} {tx.currency}
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

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
                            <SelectItem value="transfer">Transfer</SelectItem>
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
                              {acc.name}
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
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          rows={3}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.note?.message}</FormMessage>
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
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.transaction_time?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
                {deleteError ? <p className="text-sm text-red-500">{deleteError}</p> : null}

                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Saving..." : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
