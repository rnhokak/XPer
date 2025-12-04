"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { cashflowQuickAddSchema, type CashflowQuickAddValues } from "@/lib/validation/cashflow";

type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  note: string | null;
  transaction_time: string;
  category?: { id?: string | null; name?: string | null } | null;
  account?: { id?: string | null; name?: string | null; currency?: string | null } | null;
};
type Category = { id: string; name: string; type: "income" | "expense" };
type Account = { id: string; name: string; currency: string };

const formatNumber = (value: number) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const formatDateTime = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const NONE_VALUE = "__none__";

export function CashflowTransactionList({
  transactions,
  categories,
  accounts,
}: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sorted = useMemo(() => {
    const data = [...transactions].sort((a, b) => {
      const aTime = new Date(a.transaction_time).getTime();
      const bTime = new Date(b.transaction_time).getTime();
      return Number.isNaN(bTime) || Number.isNaN(aTime) ? 0 : bTime - aTime;
    });
    return data;
  }, [transactions]);

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

  const openDetail = (tx: Transaction) => {
    setSubmitError(null);
    setDeleteError(null);
    form.reset({
      type: tx.type,
      amount: tx.amount,
      account_id: tx.account?.id ?? null,
      category_id: tx.category?.id ?? null,
      note: tx.note ?? "",
      transaction_time: new Date(tx.transaction_time).toISOString().slice(0, 16),
      currency: tx.currency,
    });
    setSelected(tx);
  };

  const handleSave = async (values: CashflowQuickAddValues) => {
    if (!selected) return;
    setSubmitError(null);
    const payload = {
      ...values,
      category_id: values.category_id || null,
      account_id: values.account_id || null,
      transaction_time: values.transaction_time ? new Date(values.transaction_time).toISOString() : null,
    };

    const res = await fetch("/api/cashflow/transactions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, ...payload }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Cập nhật thất bại");
      return;
    }
    setSelected(null);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleteError(null);
    setDeleting(true);
    const res = await fetch("/api/cashflow/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id }),
    });
    setDeleting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setDeleteError(err.error ?? "Xoá thất bại");
      return;
    }
    setSelected(null);
    router.refresh();
  };

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="md:hidden space-y-2">
        {sorted.map((tx) => (
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
              <div className={`text-base font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                {tx.type === "income" ? "+" : "-"}
                {formatNumber(tx.amount)} {tx.currency}
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
            {sorted.map((tx) => (
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
                <TableCell className={`text-right font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                  {tx.type === "income" ? "+" : "-"}
                  {formatNumber(tx.amount)} {tx.currency}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chi tiết giao dịch</DialogTitle>
            <DialogDescription>Xem, sửa hoặc xoá giao dịch.</DialogDescription>
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select
                          value={field.value ?? NONE_VALUE}
                          onValueChange={(val) => field.onChange(val === NONE_VALUE ? null : val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>None</SelectItem>
                            {categories
                              .filter((c) => c.type === form.watch("type"))
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage>{form.formState.errors.category_id?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
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
                </div>

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
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage>{form.formState.errors.note?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
                {deleteError ? <p className="text-sm text-red-500">{deleteError}</p> : null}

                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="destructive"
                    className="sm:order-1"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Đang xoá..." : "Xoá"}
                  </Button>
                  <div className="flex w-full justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                      Đóng
                    </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
