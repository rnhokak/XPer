"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { debtPaymentSchema, type DebtPaymentInput } from "@/lib/validation/debts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };
type Category = { id: string; name: string; type: "income" | "expense" };

type Props = {
  debtId: string;
  direction: "lend" | "borrow";
  currency: string;
  defaultAccountId?: string | null;
  accounts: Account[];
  categories: Category[];
  remainingPrincipal: number;
};

const defaultDateTime = () => new Date().toISOString().slice(0, 16);
const EMPTY_SELECT_VALUE = "__none__";

export function DebtPaymentForm({
  debtId,
  direction,
  currency,
  defaultAccountId,
  accounts,
  categories,
  remainingPrincipal,
}: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<DebtPaymentInput>({
    resolver: zodResolver(debtPaymentSchema),
    defaultValues: {
      debt_id: debtId,
      amount: undefined,
      principal_amount: undefined,
      interest_amount: undefined,
      account_id: defaultAccountId ?? null,
      category_id: null,
      currency,
      payment_date: defaultDateTime(),
      note: "",
    },
  });

  useEffect(() => {
    form.setValue("account_id", defaultAccountId ?? null);
  }, [defaultAccountId, form]);

  const amount = useWatch({ control: form.control, name: "amount" });

  useEffect(() => {
    if (amount && !form.getFieldState("principal_amount").isTouched) {
      form.setValue("principal_amount", amount);
    }
  }, [amount, form]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => (direction === "borrow" ? c.type === "expense" : c.type === "income")),
    [categories, direction]
  );

  const onSubmit = async (values: DebtPaymentInput) => {
    setSubmitError(null);
    const payload = {
      ...values,
      debt_id: debtId,
      account_id: values.account_id || defaultAccountId || null,
      category_id: values.category_id || null,
      payment_date: values.payment_date || undefined,
      currency: values.currency || currency,
      principal_amount: values.principal_amount ?? values.amount,
      interest_amount: values.interest_amount ?? null,
      note: values.note?.trim() || undefined,
    };

    const res = await fetch("/api/debts/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Không thể ghi nhận thanh toán");
      return;
    }

    form.reset({
      debt_id: debtId,
      amount: undefined,
      principal_amount: undefined,
      interest_amount: undefined,
      account_id: defaultAccountId ?? null,
      category_id: null,
      currency,
      payment_date: defaultDateTime(),
      note: "",
    });
    router.refresh();
  };

  const paymentLabel = direction === "borrow" ? "Trả nợ (expense)" : "Thu nợ (income)";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{paymentLabel}</CardTitle>
          <div className="text-right text-sm text-muted-foreground">
            <p>Còn lại: {remainingPrincipal.toLocaleString()} {currency}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <div className="space-y-3">
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <Form {...form}>
            <form className="grid gap-4 md:grid-cols-[1.05fr,0.95fr]" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-3 rounded-lg border bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số tiền</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} type="number" min="0" step="0.01" />
                        </FormControl>
                        <FormMessage>{form.formState.errors.amount?.message}</FormMessage>
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
                          <Input {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage>{form.formState.errors.currency?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="principal_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gốc</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} type="number" min="0" step="0.01" />
                        </FormControl>
                        <FormMessage>{form.formState.errors.principal_amount?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="interest_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lãi</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} type="number" min="0" step="0.01" />
                        </FormControl>
                        <FormMessage>{form.formState.errors.interest_amount?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="payment_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ngày thanh toán</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} type="datetime-local" />
                      </FormControl>
                      <FormMessage>{form.formState.errors.payment_date?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ghi chú</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ""} rows={3} />
                      </FormControl>
                      <FormMessage>{form.formState.errors.note?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3 rounded-lg border bg-white p-4">
                <FormField
                    control={form.control}
                    name="account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tài khoản cashflow</FormLabel>
                        <Select value={field.value ?? EMPTY_SELECT_VALUE} onValueChange={(v) => field.onChange(v === EMPTY_SELECT_VALUE ? null : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn tài khoản" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EMPTY_SELECT_VALUE}>Mặc định</SelectItem>
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

                <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value ?? EMPTY_SELECT_VALUE} onValueChange={(v) => field.onChange(v === EMPTY_SELECT_VALUE ? null : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Tuỳ chọn" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EMPTY_SELECT_VALUE}>Không gán</SelectItem>
                            {filteredCategories.map((c) => (
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

                {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Đang lưu..." : paymentLabel}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Transaction cashflow sẽ tự tạo ({direction === "borrow" ? "expense" : "income"}) và liên kết với debt_payments.
                </p>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
