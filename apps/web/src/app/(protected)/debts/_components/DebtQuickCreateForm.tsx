"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { debtCreateSchema, type DebtCreateInput } from "@/lib/validation/debts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Partner = { id: string; name: string; type: string | null };
type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null };
type Category = { id: string; name: string; type: "income" | "expense" | "transfer" };

type Props = {
  partners: Partner[];
  accounts: Account[];
  categories: Category[];
  defaultAccountId?: string | null;
  defaultCurrency: string;
};

const defaultDate = () => new Date().toISOString().slice(0, 10);
const defaultDateTime = () => new Date().toISOString().slice(0, 16);
const EMPTY_SELECT_VALUE = "__none__";

export function DebtQuickCreateForm({ partners, accounts, categories, defaultAccountId, defaultCurrency }: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<DebtCreateInput>({
    resolver: zodResolver(debtCreateSchema),
    defaultValues: {
      partner_id: partners[0]?.id,
      direction: "lend",
      principal_amount: undefined,
      currency: defaultCurrency,
      start_date: defaultDate(),
      due_date: null,
      interest_type: "none",
      interest_rate: undefined,
      interest_cycle: undefined,
      account_id: defaultAccountId ?? null,
      category_id: null,
      transaction_time: defaultDateTime(),
      note: "",
      description: "",
    },
  });

  useEffect(() => {
    form.setValue("account_id", defaultAccountId ?? null);
    form.setValue("currency", defaultCurrency);
  }, [defaultAccountId, defaultCurrency, form]);

  const direction = useWatch({ control: form.control, name: "direction" }) ?? "lend";
  const interestType = useWatch({ control: form.control, name: "interest_type" }) ?? "none";

  const filteredCategories = useMemo(
    () => categories.filter((c) => (direction === "borrow" ? c.type === "income" : c.type === "expense")),
    [categories, direction]
  );

  useEffect(() => {
    if (interestType === "none") {
      form.setValue("interest_rate", undefined);
      form.setValue("interest_cycle", undefined);
    }
  }, [interestType, form]);

  const onSubmit = async (values: DebtCreateInput) => {
    setSubmitError(null);
    const payload: Partial<DebtCreateInput> & { partner_id: string; direction: "lend" | "borrow"; principal_amount: number } = {
      ...values,
      currency: values.currency || defaultCurrency,
      account_id: values.account_id || defaultAccountId || null,
      category_id: values.category_id || null,
      due_date: values.due_date || null,
      interest_cycle: values.interest_cycle || null,
      interest_rate: values.interest_rate ?? null,
      transaction_time: values.transaction_time || undefined,
      note: values.note?.trim() || undefined,
      description: values.description?.trim() || undefined,
    };

    const res = await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Không thể tạo khoản vay");
      return;
    }

    form.reset({
      partner_id: values.partner_id,
      direction: values.direction,
      principal_amount: undefined,
      currency: defaultCurrency,
      start_date: defaultDate(),
      due_date: null,
      interest_type: values.interest_type,
      interest_rate: values.interest_rate ?? undefined,
      interest_cycle: values.interest_cycle ?? undefined,
      account_id: defaultAccountId ?? null,
      category_id: null,
      transaction_time: defaultDateTime(),
      note: "",
      description: "",
    });
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thêm nhanh khoản vay</CardTitle>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <div className="space-y-3">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <Form {...form}>
            <form className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-3 rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                    {direction === "lend" ? "Cho vay" : "Đi vay"}
                  </div>
                  <div className="flex gap-2">
                    {(["lend", "borrow"] as const).map((dir) => (
                      <Button
                        key={dir}
                        type="button"
                        size="sm"
                        variant={direction === dir ? "default" : "outline"}
                        onClick={() => form.setValue("direction", dir)}
                      >
                        {dir === "lend" ? "Cho vay" : "Đi vay"}
                      </Button>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="partner_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Đối tác</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn đối tác" />
                        </SelectTrigger>
                        <SelectContent>
                          {partners.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage>{form.formState.errors.partner_id?.message}</FormMessage>
                      {partners.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Bạn cần thêm đối tác ở khối bên cạnh trước.</p>
                      ) : null}
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="principal_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số tiền gốc</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} type="number" min="0" step="0.01" />
                        </FormControl>
                        <FormMessage>{form.formState.errors.principal_amount?.message}</FormMessage>
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
                        <FormLabel>Category (cashflow)</FormLabel>
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
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bắt đầu</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} type="date" />
                        </FormControl>
                        <FormMessage>{form.formState.errors.start_date?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Đến hạn (tuỳ chọn)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} type="date" />
                        </FormControl>
                        <FormMessage>{form.formState.errors.due_date?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="transaction_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Thời gian giải ngân</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} type="datetime-local" />
                        </FormControl>
                        <FormMessage>{form.formState.errors.transaction_time?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="interest_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loại lãi</FormLabel>
                        <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Không</SelectItem>
                            <SelectItem value="fixed">Cố định</SelectItem>
                            <SelectItem value="percent">% theo kỳ</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage>{form.formState.errors.interest_type?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="interest_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lãi suất</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={interestType === "none"}
                          />
                        </FormControl>
                        <FormMessage>{form.formState.errors.interest_rate?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="interest_cycle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kỳ tính lãi</FormLabel>
                        <Select
                          value={field.value ?? "unspecified"}
                          disabled={interestType === "none"}
                          onValueChange={(v) => field.onChange(v === "unspecified" ? undefined : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn kỳ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unspecified">Chưa chọn</SelectItem>
                            <SelectItem value="day">Ngày</SelectItem>
                            <SelectItem value="month">Tháng</SelectItem>
                            <SelectItem value="year">Năm</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage>{form.formState.errors.interest_cycle?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note (ghi cùng transaction)</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ""} rows={3} />
                      </FormControl>
                      <FormMessage>{form.formState.errors.note?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3 rounded-lg border bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Mô tả khoản vay</p>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ""} rows={8} placeholder="Thông tin thêm, lịch trả, tài sản bảo đảm..." />
                      </FormControl>
                      <FormMessage>{form.formState.errors.description?.message}</FormMessage>
                    </FormItem>
                  )}
                />
                {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
                <Button type="submit" disabled={form.formState.isSubmitting || partners.length === 0}>
                  {form.formState.isSubmitting ? "Đang tạo..." : "Tạo và ghi nhận cashflow"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Hệ thống sẽ tạo transaction cashflow với loại {direction === "borrow" ? "income (nhận tiền)" : "expense (chi ra)"} và
                  liên kết vào debt_payments.
                </p>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
