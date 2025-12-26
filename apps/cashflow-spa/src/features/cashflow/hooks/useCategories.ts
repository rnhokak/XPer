import { useQuery } from "@tanstack/react-query";
import { cashflowApi, type CategoryDto } from "@/lib/api/cashflowApi";

export const useCategories = () => {
  return useQuery<CategoryDto[]>({
    queryKey: ["cashflow", "categories"],
    queryFn: cashflowApi.getCategories,
    staleTime: 1000 * 60 * 20,
    gcTime: 1000 * 60 * 60 * 12,
  });
};
