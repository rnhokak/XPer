"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { partnerTransactionSchema, type PartnerTransactionInput } from "@/lib/validation/partners";

export type PartnerOption = { id: string; name: string };
export type AccountOption = { id: string; name: string; currency: string };
export type CategoryOption = { id: string; name: string; type: "income" | "expense" | "transfer" };

const toDateInputValue = (value?: string | null) => {
  if (!value) return new Date().toISOString().slice(0, 16);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 16) : d.toISOString().slice(0, 16);
};

const directionLabel: Record<PartnerTransactionInput["direction"], string> = {
  lend: "Cho vay (họ nợ tôi)",
  borrow: "Đi vay (tôi nợ họ)",
  repay: "Tôi trả",
  receive: "Họ trả",
};

const directionNote: Record<PartnerTransactionInput["direction"], string> = {
  lend: "Ghi nhận chi phí, tạo khoản họ nợ tôi",
  borrow: "Ghi nhận thu nhập, tăng khoản tôi nợ họ",
  repay: "Chi phí, giảm khoản tôi nợ",
  receive: "Thu nhập, giảm khoản họ nợ",
};

type Props = {
  partners: PartnerOption[];
  accounts: AccountOption[];
  categories: CategoryOption[];
  defaultCurrency: string;
  defaultPartnerId?: string;
  presetDirection?: PartnerTransactionInput["direction"];
  trigger: ReactNode;
  onCompleted?: () => void;
};

export function PartnerTransactionFormDialog({
  partners,
  accounts,
  categories,
  defaultCurrency,
  defaultPartnerId,
  presetDirection,
  trigger,
  onCompleted,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fallbackPartnerId = useMemo(() => defaultPartnerId ?? partners[0]?.id ?? "", [defaultPartnerId, partners]);

  const form = useForm<PartnerTransactionInput>({
    resolver: zodResolver(partnerTransactionSchema),
    defaultValues: {
      partner_id: fallbackPartnerId,
      direction: presetDirection ?? "lend",
      amount: 0,
      principal_amount: undefined,
      interest_amount: undefined,
      account_id: accounts[0]?.id ?? null,
      category_id: null,
      currency: defaultCurrency,
      date: toDateInputValue(),
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      partner_id: fallbackPartnerId,
      direction: presetDirection ?? form.getValues("direction") ?? "lend",
      amount: 0,
      principal_amount: undefined,
      interest_amount: undefined,
      account_id: form.getValues("account_id") ?? accounts[0]?.id ?? null,
      category_id: null,
      currency: defaultCurrency,
      date: toDateInputValue(),
      note: "",
    });
    setSubmitError(null);
  }, [open, fallbackPartnerId, presetDirection, accounts, defaultCurrency, form]);

  const handleSubmit = async (values: PartnerTransactionInput) => {
    setSubmitError(null);
    if (!values.partner_id) {
      setSubmitError("Chọn đối tác trước khi lưu");
      return;
    }

    const payload = {
      ...values,
      account_id: values.account_id || null,
      category_id: values.category_id || null,
      principal_amount: values.principal_amount ?? null,
      interest_amount: values.interest_amount ?? null,
      currency: values.currency || defaultCurrency,
      date: values.date ? new Date(values.date).toISOString() : new Date().toISOString(),
      note: values.note?.trim() || null,
    };

    const res = await fetch("/api/partners/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Không tạo được giao dịch");
      return;
    }

    onCompleted?.();
    router.refresh();
    setOpen(false);
  };

  const disabled = partners.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm giao dịch với đối tác</DialogTitle>
          <DialogDescription>Ghi nhận mọi dòng tiền (cho vay, đi vay, trả, nhận) và tự động gắn cashflow.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="partner_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Đối tác</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
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
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại giao dịch</FormLabel>
                    <Select value={field.value ?? "lend"} onValueChange={field.onChange} disabled={Boolean(presetDirection)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lend">{directionLabel.lend}</SelectItem>
                        <SelectItem value="borrow">{directionLabel.borrow}</SelectItem>
                        <SelectItem value="repay">{directionLabel.repay}</SelectItem>
                        <SelectItem value="receive">{directionLabel.receive}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{directionNote[field.value ?? "lend"]}</p>
                    <FormMessage>{form.formState.errors.direction?.message}</FormMessage>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tiền tệ</FormLabel>
                    <FormControl>
                      <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} placeholder={defaultCurrency} />
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
                    <Select value={field.value ?? "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn tài khoản" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Không gắn</SelectItem>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} · {a.currency}
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
                    <FormLabel>Danh mục</FormLabel>
                    <Select value={field.value ?? "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Không phân loại" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Không</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.category_id?.message}</FormMessage>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngày giao dịch</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.date?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="principal_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gốc (tuỳ chọn)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          placeholder="Nếu cần tách gốc/lãi"
                        />
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
                      <FormLabel>Lãi (tuỳ chọn)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.interest_amount?.message}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea rows={3} value={field.value ?? ""} onChange={field.onChange} placeholder="Mô tả thêm (ví dụ: chuyển khoản, tiền mặt)" />
                  </FormControl>
                  <FormMessage>{form.formState.errors.note?.message}</FormMessage>
                </FormItem>
              )}
            />

            {disabled ? <p className="text-sm text-red-600">Cần tạo đối tác trước khi ghi giao dịch.</p> : null}
            {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || disabled}>
                {form.formState.isSubmitting ? "Đang lưu..." : "Lưu giao dịch"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
