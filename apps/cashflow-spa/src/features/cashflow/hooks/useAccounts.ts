import { useQuery } from "@tanstack/react-query";
import { cashflowApi, type AccountDto } from "@/lib/api/cashflowApi";

export const useAccounts = () => {
  return useQuery<AccountDto[]>({
    queryKey: ["cashflow", "accounts"],
    queryFn: cashflowApi.getAccounts,
    staleTime: 1000 * 60 * 20,
    gcTime: 1000 * 60 * 60 * 12,
  });
};
