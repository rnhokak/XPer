"use client";

import { useMemo, useState } from "react";
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
}

const defaultDateTimeValue = () => new Date().toISOString().slice(0, 16);

const currencyFormatter = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");

type MonthlyBucket = {
  label: string;
  deposit: number;
  withdraw: number;
};

const buildMonthlyBuckets = (rows: FundingRow[], months = 6): MonthlyBucket[] => {
  const now = new Date();
  const buckets: MonthlyBucket[] = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const label = date.toLocaleString(undefined, { month: "short" });
    buckets.push({ label, deposit: 0, withdraw: 0 });
  }

  rows.forEach((row) => {
    const ts = row.transaction_time ? new Date(row.transaction_time) : null;
    if (!ts) return;
    const label = ts.toLocaleString(undefined, { month: "short" });
    const bucket = buckets.find((b) => b.label === label);
    if (!bucket) return;
    if (row.type === "deposit") bucket.deposit += Number(row.amount ?? 0);
    if (row.type === "withdraw") bucket.withdraw += Number(row.amount ?? 0);
  });

  return buckets;
};

const methodOptions = ["Bank transfer", "Wallet", "Broker transfer", "Refund"];

export default function FundingPageClient({ initialData }: FundingPageClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const monthlyBuckets = useMemo(() => buildMonthlyBuckets(initialData), [initialData]);

  const form = useForm<FundingFormValues>({
    resolver: zodResolver(fundingFormSchema),
    defaultValues: {
      type: "deposit",
      amount: 0,
      currency: "USD",
      method: methodOptions[0],
      note: undefined,
      transaction_time: defaultDateTimeValue(),
    },
  });

  const handleSubmit = async (values: FundingFormValues) => {
    setSubmitError(null);
    const payload = {
      ...values,
      transaction_time: new Date(values.transaction_time).toISOString(),
      note: values.note?.trim() ? values.note.trim() : null,
    };

    const res = await fetch("/api/trading/funding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      setSubmitError(error.error ?? "Failed to save transaction");
      return;
    }

    form.reset({
      type: "deposit",
      amount: 0,
      currency: "USD",
      method: methodOptions[0],
      note: undefined,
      transaction_time: defaultDateTimeValue(),
    });
    setDialogOpen(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Funding history</h1>
          <p className="text-sm text-muted-foreground">Track deposits and withdrawals tied to your trading balance.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">New transaction</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add transaction</DialogTitle>
              <DialogDescription>Record a deposit or withdrawal against your trading account.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deposit">Deposit</SelectItem>
                            <SelectItem value="withdraw">Withdraw</SelectItem>
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
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                            placeholder="0.00"
                          />
                        </FormControl>
                        <FormMessage>{form.formState.errors.amount?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="USD" />
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
                        <FormLabel>Method</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
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
                      <FormLabel>Transaction time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          className="h-11 rounded-lg border-muted-foreground/20 bg-white text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/70"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          step="60"
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.transaction_time?.message}</FormMessage>
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
                          rows={3}
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

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Saving..." : "Save transaction"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
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
                <div key={row.id} className="rounded-lg border bg-white p-2 shadow-sm">
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
