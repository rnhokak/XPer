"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { FundingRow } from "./page";
import { fundingFormSchema, type FundingFormValues } from "@/lib/validation/trading";

interface FundingPageClientProps {
  initialData: FundingRow[];
  serverNow?: string;
}

const toLocalInput = (isoString: string) => {
  const date = new Date(isoString);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const defaultDateTimeValue = (anchor?: string | Date) => {
  const iso = anchor instanceof Date ? anchor.toISOString() : anchor ?? new Date().toISOString();
  return toLocalInput(iso);
};
const toInputDateTime = (value?: string | null, fallback?: string | Date) =>
  value ? toLocalInput(value) : defaultDateTimeValue(fallback);

const currencyFormatter = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";

type FundingFormInput = Omit<FundingFormValues, "amount"> & { amount?: number };
const timePresets = [
  { label: "Now", minutes: 0 },
  { label: "-1h", minutes: -60 },
  { label: "-1d", minutes: -1440 },
  { label: "-1w", minutes: -10080 },
];

type MonthlyBucket = {
  label: string;
  deposit: number;
  withdraw: number;
};

const buildMonthlyBuckets = (rows: FundingRow[], months = 6, anchorIso?: string): MonthlyBucket[] => {
  const now = anchorIso ? new Date(anchorIso) : new Date();
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const buckets: MonthlyBucket[] = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
    const label = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    buckets.push({ label, deposit: 0, withdraw: 0 });
  }

  rows.forEach((row) => {
    const ts = row.transaction_time ? new Date(row.transaction_time) : null;
    if (!ts) return;
    const label = ts.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const bucket = buckets.find((b) => b.label === label);
    if (!bucket) return;
    if (row.type === "deposit") bucket.deposit += Number(row.amount ?? 0);
    if (row.type === "withdraw") bucket.withdraw += Number(row.amount ?? 0);
  });

  return buckets;
};

const methodOptions = ["Bank transfer", "Wallet", "Broker transfer", "Refund"];

export default function FundingPageClient({ initialData, serverNow }: FundingPageClientProps) {
  const router = useRouter();
  const anchorDate = useMemo(() => (serverNow ? new Date(serverNow) : new Date()), [serverNow]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<FundingRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FundingRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [mounted, setMounted] = useState(false);

  const totals = useMemo(() => {
    const deposited = initialData
      .filter((row) => row.type === "deposit")
      .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
    const withdrawn = initialData
      .filter((row) => row.type === "withdraw")
      .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
    return {
      deposited,
      withdrawn,
      net: deposited - withdrawn,
    };
  }, [initialData]);

  const initialTransactionTime = useMemo(() => defaultDateTimeValue(anchorDate), [anchorDate]);
  const monthlyBuckets = useMemo(() => buildMonthlyBuckets(initialData, 6, serverNow), [initialData, serverNow]);

  const form = useForm<FundingFormInput>({
    resolver: zodResolver(fundingFormSchema),
    defaultValues: {
      type: "deposit",
      amount: undefined,
      currency: "USD",
      method: methodOptions[0],
      note: undefined,
      transaction_time: initialTransactionTime,
    },
  });
  const selectedType = form.watch("type");
  useEffect(() => {
    setMounted(true);
  }, []);

  const openNewDialog = () => {
    form.reset({
      type: "deposit",
      amount: undefined,
      currency: "USD",
      method: methodOptions[0],
      note: undefined,
      transaction_time: initialTransactionTime,
    });
    setAmountInput("");
    setEditingRow(null);
    setSubmitError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (row: FundingRow) => {
    setEditingRow(row);
    form.reset({
      type: row.type,
      amount: row.amount ?? undefined,
      currency: row.currency,
      method: row.method,
      note: row.note ?? undefined,
      transaction_time: toInputDateTime(row.transaction_time, anchorDate),
    });
    setAmountInput(row.amount !== null && row.amount !== undefined ? String(row.amount) : "");
    setSubmitError(null);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingRow(null);
      setSubmitError(null);
      setAmountInput("");
    }
  };

  const handleAmountChange = (raw: string, onChange: (value?: number) => void) => {
    setAmountInput(raw);
    const normalized = raw.replace(",", ".").trim();
    if (!normalized || normalized === "." || normalized === "-") {
      onChange(undefined);
      return;
    }
    const parsed = Number(normalized.startsWith(".") ? `0${normalized}` : normalized);
    onChange(Number.isFinite(parsed) ? parsed : undefined);
  };

  const handleSubmit = async (values: FundingFormInput) => {
    if (typeof values.amount !== "number") {
      setSubmitError("Amount is required");
      return;
    }
    setSubmitError(null);
    const payload = {
      ...values,
      amount: Number(values.amount),
      transaction_time: new Date(values.transaction_time).toISOString(),
      note: values.note?.trim() ? values.note.trim() : null,
    };

    const res = await fetch("/api/trading/funding", {
      method: editingRow ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingRow ? { id: editingRow.id, ...payload } : payload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      setSubmitError(error.error ?? "Failed to save transaction");
      return;
    }

    form.reset({
      type: "deposit",
      amount: undefined,
      currency: "USD",
      method: methodOptions[0],
      note: undefined,
      transaction_time: defaultDateTimeValue(anchorDate),
    });
    setAmountInput("");
    setDialogOpen(false);
    setEditingRow(null);
    router.refresh();
  };

  const formSkeleton = (
    <div className="space-y-3">
      <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
    </div>
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    const res = await fetch("/api/trading/funding", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteTarget.id }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      setDeleteError(error.error ?? "Failed to delete transaction");
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setDeleteTarget(null);
    router.refresh();
  };

  const requestDelete = (row: FundingRow) => {
    setDeleteError(null);
    setDeleteTarget(row);
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Funding history</h1>
          <p className="text-sm text-muted-foreground">Track deposits and withdrawals tied to your trading balance.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={openNewDialog}>
              New transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[min(520px,calc(100vw-20px))] max-h-[90vh] overflow-y-auto rounded-2xl border-0 bg-gradient-to-b from-white via-white to-muted/40 p-4 shadow-xl sm:max-w-lg sm:p-6">
            <DialogHeader>
              <DialogTitle>{editingRow ? "Edit transaction" : "Add transaction"}</DialogTitle>
              <DialogDescription>
                {editingRow
                  ? "Update a deposit or withdrawal entry."
                  : "Record a deposit or withdrawal against your trading account."}
              </DialogDescription>
            </DialogHeader>
            {mounted ? (
              <Form {...form}>
                <div className="mb-2 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Quick entry</p>
                    <p className="text-xs text-muted-foreground">Thiết kế tối ưu cho iOS – thao tác một tay.</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      selectedType === "deposit" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {selectedType === "deposit" ? "Deposit" : "Withdraw"}
                  </span>
                </div>
                <form className="space-y-4 pb-2 sm:pb-0" onSubmit={form.handleSubmit(handleSubmit)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Type</FormLabel>
                          <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-1">
                            {(["deposit", "withdraw"] as const).map((option) => (
                              <Button
                                key={option}
                                type="button"
                                variant={field.value === option ? "default" : "ghost"}
                                className={`flex-1 rounded-lg border border-transparent text-sm ${field.value === option ? "bg-foreground text-white hover:bg-foreground" : "bg-white"}`}
                                onClick={() => field.onChange(option)}
                              >
                                {option === "deposit" ? "Deposit" : "Withdraw"}
                              </Button>
                            ))}
                          </div>
                          <FormMessage>{form.formState.errors.type?.message}</FormMessage>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Amount</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              pattern="[0-9]*[.,]?[0-9]*"
                              inputMode="decimal"
                              className="h-12 rounded-xl text-base"
                              value={amountInput}
                              onChange={(e) => handleAmountChange(e.target.value, field.onChange)}
                              onBlur={(e) => setAmountInput(e.target.value.trim())}
                              placeholder="0.00"
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
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Currency</FormLabel>
                          <FormControl>
                            <Input {...field} className="h-12 rounded-xl text-base" placeholder="USD" />
                          </FormControl>
                          <FormMessage>{form.formState.errors.currency?.message}</FormMessage>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Method</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-12 rounded-xl text-base">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                              {methodOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage>{form.formState.errors.method?.message}</FormMessage>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="transaction_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Transaction time</FormLabel>
                        <div className="space-y-2 rounded-xl border bg-white/70 p-3 shadow-sm">
                          <div className="flex flex-wrap gap-2">
                            {timePresets.map((preset) => {
                              const presetValue = new Date(anchorDate.getTime() + preset.minutes * 60 * 1000);
                              const presetInput = presetValue.toISOString().slice(0, 16);
                              const isActive =
                                field.value &&
                                Math.abs(new Date(field.value).getTime() - presetValue.getTime()) < 60 * 1000;
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
                          </div>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              className="h-12 rounded-xl border-muted-foreground/30 bg-white text-base shadow-sm focus-visible:ring-2 focus-visible:ring-primary/70"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              step="60"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Use quick shortcuts or pick a custom date & time.</p>
                        </div>
                        <FormMessage>{form.formState.errors.transaction_time?.message}</FormMessage>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Note</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            className="rounded-xl text-base"
                            placeholder="Optional memo"
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

                  <DialogFooter className="sticky bottom-0 -mx-4 -mb-4 mt-2 flex flex-col gap-2 border-t bg-white/90 px-4 py-3 backdrop-blur sm:static sm:m-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                    <Button className="w-full sm:w-auto" type="button" variant="ghost" onClick={() => handleDialogChange(false)}>
                      Cancel
                    </Button>
                    <Button className="w-full sm:w-auto" type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? "Saving..." : editingRow ? "Update transaction" : "Save transaction"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            ) : (
              formSkeleton
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total deposited</CardDescription>
            <CardTitle>{currencyFormatter(totals.deposited, initialData[0]?.currency ?? "USD")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">All time deposits</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total withdrawn</CardDescription>
            <CardTitle>{currencyFormatter(totals.withdrawn, initialData[0]?.currency ?? "USD")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Cash moved out</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net deposits</CardDescription>
            <CardTitle>{currencyFormatter(totals.net, initialData[0]?.currency ?? "USD")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Deposits minus withdrawals since inception
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>Chronological list of deposits and withdrawals.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-xl border bg-gradient-to-r from-primary/5 via-emerald-50/40 to-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Deposits vs Withdrawals</p>
                <p className="text-xs text-muted-foreground">Last 6 months</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Deposit
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Withdraw
                </span>
              </div>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[320px] grid-cols-2 gap-3 sm:min-w-0 sm:grid-cols-3 md:grid-cols-6">
                {monthlyBuckets.map((bucket) => {
                  const maxVal = Math.max(bucket.deposit, bucket.withdraw, 1);
                  const depositHeight = Math.round((bucket.deposit / maxVal) * 100);
                  const withdrawHeight = Math.round((bucket.withdraw / maxVal) * 100);
                  return (
                    <div
                      key={bucket.label}
                      className="flex flex-col items-center gap-2 rounded-lg bg-white/70 p-2 shadow-sm ring-1 ring-black/5"
                    >
                      <div className="flex h-24 w-full items-end gap-1">
                        <div className="flex-1 rounded-sm bg-emerald-500/80" style={{ height: `${depositHeight}%` }} />
                        <div className="flex-1 rounded-sm bg-red-500/80" style={{ height: `${withdrawHeight}%` }} />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold text-foreground">{bucket.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {bucket.deposit ? currencyFormatter(bucket.deposit, initialData[0]?.currency ?? "USD") : "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {bucket.withdraw ? `-${currencyFormatter(bucket.withdraw, initialData[0]?.currency ?? "USD")}` : "—"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {initialData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet. Add your first deposit or withdrawal.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 md:hidden">
                {initialData.map((row) => (
                  <div key={row.id} className="rounded-lg border bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">{formatDateTime(row.transaction_time)}</div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                          row.type === "deposit" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {row.type === "deposit" ? "Deposit" : "Withdraw"}
                      </span>
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      {currencyFormatter(row.amount, row.currency)}{" "}
                      <span className="text-xs text-muted-foreground">({row.currency})</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Method</p>
                        <p className="font-medium text-foreground">{row.method}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Note</p>
                        <p className="text-foreground">{row.note ?? "—"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEditDialog(row)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-red-600 hover:text-red-600"
                        onClick={() => requestDelete(row)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-[320px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date / time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDateTime(row.transaction_time)}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                              row.type === "deposit" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {row.type === "deposit" ? "Deposit" : "Withdraw"}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {currencyFormatter(row.amount, row.currency)}{" "}
                          <span className="text-xs text-muted-foreground">({row.currency})</span>
                        </TableCell>
                        <TableCell className="text-sm">{row.method}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.note ?? "—"}</TableCell>
                        <TableCell className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(row)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-600"
                            onClick={() => requestDelete(row)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
            setDeleting(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete transaction</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The transaction will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-red-500">{deleteError}</p> : null}
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
