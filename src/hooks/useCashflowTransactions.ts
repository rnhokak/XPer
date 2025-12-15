"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { normalizeCashflowRange } from "@/lib/cashflow/utils";
import { type CashflowTransactionType } from "@/lib/validation/cashflow";

export type CashflowTransaction = {
  id: string;
  type: CashflowTransactionType;
  amount: number;
  currency: string;
  note: string | null;
  transaction_time: string;
  category?: { id?: string | null; name?: string | null; type?: string | null } | null;
  account?: { id?: string | null; name?: string | null; currency?: string | null } | null;
};

export const cashflowTransactionsQueryKey = (range: string) => ["cashflow-transactions", normalizeCashflowRange(range)];

export function useCashflowTransactions(range: string, initialData: CashflowTransaction[] = []) {
  const normalizedRange = normalizeCashflowRange(range);
  return useQuery({
    queryKey: cashflowTransactionsQueryKey(range),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (normalizedRange !== "all") {
        params.set("range", normalizedRange);
      }
      const url = params.size ? `/api/cashflow/transactions?${params}` : "/api/cashflow/transactions";
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(json)) {
        const message = (json as { error?: string } | null)?.error ?? "Failed to load transactions";
        throw new Error(message);
      }
      return json as CashflowTransaction[];
    },
    initialData,
    staleTime: 30_000,
    gcTime: 60 * 1000 * 5,
    placeholderData: keepPreviousData,
  });
}
