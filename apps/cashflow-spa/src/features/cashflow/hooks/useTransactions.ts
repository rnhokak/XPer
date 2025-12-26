import { useQuery } from "@tanstack/react-query";
import { cashflowApi, type TransactionDto } from "@/lib/api/cashflowApi";

export const useTransactions = () => {
  return useQuery<TransactionDto[]>({
    queryKey: ["cashflow", "transactions"],
    queryFn: () => cashflowApi.getTransactions(50),
    staleTime: 60_000,
    gcTime: 1000 * 60 * 60 * 12,
  });
};
