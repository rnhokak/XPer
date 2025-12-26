import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAccounts } from "@/features/cashflow/hooks/useAccounts";
import { useCategories } from "@/features/cashflow/hooks/useCategories";
import { cashflowApi } from "@/lib/api/cashflowApi";
import { cashflowQuickAddSchema, type CashflowQuickAddValues } from "@/lib/validation/cashflow";
import { cn } from "@/lib/utils";

export const NewTransactionScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const form = useForm<CashflowQuickAddValues>({
    resolver: zodResolver(cashflowQuickAddSchema),
    defaultValues: {
      type: "expense",
      amount: undefined,
      note: "",
      account_id: null,
      category_id: null,
    },
  });

  const mutation = useMutation({
    mutationFn: cashflowApi.createTransaction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cashflow", "transactions"] });
      toast({ title: "Transaction saved", description: "Your cashflow entry is now recorded." });
      navigate("/");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({ title: "Could not save", description: message });
    },
  });

  const typeOptions = useMemo(
    () => [
      { value: "expense", label: "Expense" },
      { value: "income", label: "Income" },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <Button variant="ghost" className="px-0 text-slate-500 hover:text-slate-900" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">New transaction</p>
          <h1 className="text-2xl font-semibold text-slate-900">Capture it fast</h1>
        </div>
      </header>

      <Card className="p-4">
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {typeOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={form.watch("type") === option.value ? "default" : "outline"}
                  onClick={() => form.setValue("type", option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Amount</label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              {...form.register("amount")}
            />
            {form.formState.errors.amount ? (
              <p className="text-xs text-rose-500">{form.formState.errors.amount.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Note</label>
            <Input placeholder="Groceries, client invoice, etc." {...form.register("note")} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Category</label>
            {categoriesLoading ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <Controller
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <Select value={field.value ?? "none"} onValueChange={(value) => field.onChange(value === "none" ? null : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {(categories ?? []).map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name || "Untitled"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Account</label>
            {accountsLoading ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <Controller
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <Select value={field.value ?? "none"} onValueChange={(value) => field.onChange(value === "none" ? null : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick an account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No account</SelectItem>
                      {(accounts ?? []).map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name || "Untitled"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </div>

          <Button type="submit" className={cn("w-full", mutation.isPending && "opacity-80")} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save transaction"}
          </Button>
        </form>
      </Card>
    </div>
  );
};
