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

type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer" | "debt";
  parent_id: string | null;
  category_focus: CategoryFocus | null;
};
type Account = { id: string; name: string; currency: string; type?: string | null };

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

const NONE_VALUE = "__none__";

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
      category_id: null,
      note: "",
      transaction_time: "",
      currency: "VND",
    },
  });

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!transaction) return;

    form.reset({
      type: transaction.type,
      amount: transaction.amount,
      account_id: transaction.account?.id ?? null,
      category_id: transaction.category?.id ?? null,
      note: transaction.note ?? "",
      transaction_time: toLocalInputValue(transaction.transaction_time),
      currency: transaction.currency,
    });

    setUserTouchedCategory(false);
    setSuggestedCategoryId(transaction.category?.id ?? null);
  }, [transaction, form]);

  const selectedType = form.watch("type") ?? "expense";
  const selectedCategoryId = form.watch("category_id");
  const amount = form.watch("amount");
  const accountId = form.watch("account_id");
  const transactionTimeValue = form.watch("transaction_time");
  const currency = form.watch("currency") ?? transaction?.currency ?? "VND";
  const categoriesByType = useMemo(() => categories.filter((c) => c.type === selectedType), [categories, selectedType]);

  useEffect(() => {
    if (!transaction) return;

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
        (c) => c.type === selectedType && lowered.some((name) => c.name.toLowerCase().includes(name))
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
      if (storedCategory) addSuggestion(storedCategory, "Last used");
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

    if (!userTouchedCategory && suggestions[0]?.category) {
      setSuggestedCategoryId(suggestions[0].category.id);
    }
  }, [accountId, accounts, amount, categories, categoriesByType, selectedCategoryId, selectedType, transaction, transactionTimeValue, userTouchedCategory]);

  const handleSave = async (values: CashflowQuickAddValues) => {
    if (!transaction) return;
    const normalizedTime = toIsoStringWithOffset(values.transaction_time);
    await onSave({
      ...values,
      category_id: values.category_id || null,
      account_id: values.account_id || null,
      transaction_time: normalizedTime || undefined,
    });
  };

  const handleDelete = async () => {
    if (!transaction) return;
    setConfirmDeleteOpen(false);
    await onDelete();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          className={`max-h-[90vh] overflow-y-auto ${"w-full max-w-[95vw] scale-100"}`}
          style={{
            maxHeight: "calc(var(--full-vh, 100vh) - 2rem)",
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
                disabled={isDeleting}
              >
                Xoá
              </Button>
            </div>
          </DialogHeader>

          {transaction ? (
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
                        <Textarea {...field} value={field.value ?? ""} rows={3} className="resize-none" />
                      </FormControl>
                      <FormMessage>{form.formState.errors.note?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <CashflowAmountFields control={form.control} currency={currency} />
                  <CashflowDateFields control={form.control} />
                </div>

                {saveError ? <p className="text-sm text-red-500">{saveError}</p> : null}
                {deleteError ? <p className="text-sm text-red-500">{deleteError}</p> : null}

                <DialogFooter>
                  <Button type="submit" disabled={isSaving} className="min-w-[150px]">
                    {isSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                        Saving...
                      </span>
                    ) : (
                      "Save changes"
                    )}
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
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="min-w-[120px]">
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
