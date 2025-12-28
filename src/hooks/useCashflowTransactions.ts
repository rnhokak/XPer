"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { normalizeCashflowRange, normalizeRangeShift } from "@/lib/cashflow/utils";
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

export const cashflowTransactionsQueryKey = (range: string, shift = 0) => [
  "cashflow-transactions",
  normalizeCashflowRange(range),
  normalizeRangeShift(String(shift)),
];
export const cashflowReportTransactionsQueryKey = ["cashflow-report-transactions"];

export function useCashflowTransactions(range: string, shift = 0, initialData: CashflowTransaction[] = []) {
  const normalizedRange = normalizeCashflowRange(range);
  const normalizedShift = normalizeRangeShift(String(shift));
  return useQuery({
    queryKey: cashflowTransactionsQueryKey(range, shift),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("range", normalizedRange);
      if (normalizedShift !== 0) params.set("shift", String(normalizedShift));
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

export function useCashflowReportTransactions(initialData: CashflowTransaction[] = []) {
  return useQuery({
    queryKey: cashflowReportTransactionsQueryKey,
    queryFn: async () => {
      const res = await fetch("/api/cashflow/report-transactions", { method: "GET", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(json)) {
        const message = (json as { error?: string } | null)?.error ?? "Failed to load report transactions";
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
