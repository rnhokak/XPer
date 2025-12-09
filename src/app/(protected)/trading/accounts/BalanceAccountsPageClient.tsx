"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createBalanceAccountSchema, type CreateBalanceAccountInput } from "@/lib/validation/balance";
import { useNotificationsStore } from "@/store/notifications";

type BalanceAccount = {
  id: string;
  account_type: "TRADING" | "FUNDING";
  name: string;
  currency: string;
  is_active: boolean;
  created_at?: string | null;
  broker?: string | null;
  platform?: string | null;
  account_number?: string | null;
  is_demo?: boolean | null;
};

type BalanceAccountsPageClientProps = {
  initialAccounts: BalanceAccount[];
  loadError?: string | null;
};

const defaultValues: CreateBalanceAccountInput = {
  account_type: "TRADING",
  name: "",
  currency: "USD",
  is_active: true,
  is_demo: false,
};

export default function BalanceAccountsPageClient({ initialAccounts, loadError }: BalanceAccountsPageClientProps) {
  const router = useRouter();
  const notify = useNotificationsStore((state) => state.notify);
  const [editing, setEditing] = useState<BalanceAccount | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const accounts = useMemo(() => initialAccounts, [initialAccounts]);

  const form = useForm<CreateBalanceAccountInput>({
    resolver: zodResolver(createBalanceAccountSchema),
    defaultValues,
  });

  const resetForm = () => {
    setEditing(null);
    form.reset({ ...defaultValues, account_type: "TRADING" });
  };

  const onSubmit = async (values: CreateBalanceAccountInput) => {
    const payload: any = { ...values };

    const res = await fetch("/api/trading/balance-accounts", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      notify({
        type: "error",
        title: "Lưu account thất bại",
        description: err.error ?? "Failed to save account",
      });
      return;
    }

    notify({
      type: "success",
      title: editing ? "Đã cập nhật account" : "Đã tạo account",
      description: editing ? "Account đã được cập nhật." : "Account mới đã sẵn sàng sử dụng.",
    });
    resetForm();
    router.refresh();
  };

  const disableAccount = async (id: string) => {
    setDeletingId(id);
    const res = await fetch("/api/trading/balance-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      notify({
        type: "error",
        title: "Không thể vô hiệu hóa account",
        description: err.error ?? "Failed to disable account",
      });
      setDeletingId(null);
      return;
    }
    notify({
      type: "success",
      title: "Đã vô hiệu hóa account",
      description: "Account sẽ không còn dùng được cho giao dịch mới.",
    });
    setDeletingId(null);
    router.refresh();
  };

  const startEdit = (acc: BalanceAccount) => {
    setEditing(acc);
    form.reset({
      account_type: acc.account_type ?? "TRADING",
      name: acc.name,
      currency: acc.currency,
      is_active: acc.is_active,
      is_demo: acc.is_demo ?? false,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Balance Accounts</h1>
          <p className="text-sm text-muted-foreground">Quản lý ví. Account mới mặc định loại TRADING.</p>
        </div>
        <Button variant="outline" onClick={resetForm} disabled={!editing}>
          {editing ? "Reset form" : "Ready"}
        </Button>
      </div>

      {loadError ? (
        <Card>
          <CardHeader>
            <CardTitle>Lỗi tải danh sách</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{editing ? "Cập nhật account" : "Tạo account mới"}</CardTitle>
            <CardDescription>Điền tên và currency. Account mặc định loại TRADING.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="USD, VND..." />
                      </FormControl>
                      <FormMessage>{form.formState.errors.currency?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tên account</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder='e.g. "Exness MT5 #1234"' />
                      </FormControl>
                      <FormMessage>{form.formState.errors.name?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border"
                      />
                      <FormLabel className="text-sm">Kích hoạt</FormLabel>
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving..." : editing ? "Update account" : "Create account"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Danh sách account</CardTitle>
            <CardDescription>Mỗi Trading Account tương ứng 1 balance_account (wallet).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có account nào.</p>
            ) : (
              accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="rounded-xl border bg-white px-3 py-3 shadow-sm ring-1 ring-transparent transition hover:ring-emerald-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {acc.name}{" "}
                        <span className="text-xs text-muted-foreground">
                          · {acc.currency} · {acc.account_type === "TRADING" ? "Trading" : "Funding"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {acc.is_active ? "Active" : "Inactive"} ·{" "}
                        {acc.created_at ? new Date(acc.created_at).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(acc)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        disabled={!acc.is_active || deletingId === acc.id}
                        onClick={() => disableAccount(acc.id)}
                      >
                        {deletingId === acc.id ? "Disabling..." : "Disable"}
                      </Button>
                    </div>
                  </div>

                  {/* Trading detail removed per request */}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
