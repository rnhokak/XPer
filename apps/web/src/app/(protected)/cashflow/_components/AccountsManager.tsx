"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountSchema, type AccountInput } from "@/lib/validation/accounts";

type Account = { id: string; name: string; type: string | null; currency: string; is_default?: boolean | null };

const ACCOUNT_TYPES = ["cash", "bank", "broker", "e-wallet", "other"];

export function AccountsManager({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Account | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", type: undefined, currency: "USD", is_default: false },
  });

  const resetForm = () => {
    form.reset({ name: "", type: undefined, currency: "USD", is_default: false });
    setEditing(null);
    setSubmitError(null);
  };

  const upsert = async (values: AccountInput) => {
    setSubmitError(null);
    const payload = { ...values, is_default: Boolean(values.is_default) };
    const res = await fetch("/api/cashflow/accounts", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Failed to save account");
      return;
    }
    resetForm();
    router.refresh();
  };

  const remove = async (id: string) => {
    setSubmitError(null);
    const res = await fetch("/api/cashflow/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubmitError(err.error ?? "Failed to delete");
      return;
    }
    if (editing?.id === id) resetForm();
    router.refresh();
  };

  const startEdit = (acc: Account) => {
    setEditing(acc);
    form.reset({
      name: acc.name,
      type: acc.type ?? undefined,
      currency: acc.currency,
      is_default: Boolean(acc.is_default),
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
      {!mounted ? (
        <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        </div>
      ) : (
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">{editing ? "Edit account" : "New account"}</p>
            <p className="text-sm text-muted-foreground">Name & currency required; type optional.</p>
          </div>
          {editing ? (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(upsert)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage>{form.formState.errors.name?.message}</FormMessage>
                </FormItem>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type (optional)</FormLabel>
                    <Select value={field.value ?? "unspecified"} onValueChange={(v) => field.onChange(v === "unspecified" ? undefined : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unspecified">Unspecified</SelectItem>
                        {ACCOUNT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.type?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="e.g. VND" />
                    </FormControl>
                    <FormMessage>{form.formState.errors.currency?.message}</FormMessage>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="is_default"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.value ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 rounded border"
                  />
                  <FormLabel className="text-sm">Set as default account</FormLabel>
                </FormItem>
              )}
            />
            {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : editing ? "Update account" : "Add account"}
            </Button>
          </form>
        </Form>
      </div>
      )}

      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Your accounts</p>
          <span className="text-xs text-muted-foreground">{accounts.length} total</span>
        </div>
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
              <div>
                <p className="font-semibold">{acc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {acc.type ?? "—"} · {acc.currency} {acc.is_default ? "· default" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => startEdit(acc)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(acc.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {accounts.length === 0 ? <p className="text-sm text-muted-foreground">No accounts yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
