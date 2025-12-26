import { http } from "./http";
import type { CashflowQuickAddValues } from "@/lib/validation/cashflow";

export type AccountDto = {
  id: string;
  name: string | null;
  type: string | null;
  currency: string | null;
  is_default?: boolean | null;
};

export type CategoryDto = {
  id: string;
  name: string | null;
  type: string | null;
  parent_id?: string | null;
  level?: number | null;
};

export type TransactionDto = {
  id: string;
  type: "expense" | "income" | "transfer";
  amount: number;
  currency: string | null;
  note?: string | null;
  transaction_time: string;
  category?: { id?: string | null; name?: string | null; type?: string | null } | null;
  account?: { id?: string | null; name?: string | null; currency?: string | null } | null;
};

export const cashflowApi = {
  getTransactions: async (limit = 50) => {
    const data = await http
      .get("api/cashflow/transactions", {
        searchParams: {
          range: "all",
        },
      })
      .json<TransactionDto[]>();

    return data.slice(0, limit);
  },
  createTransaction: async (payload: CashflowQuickAddValues) => {
    return http.post("api/cashflow/transactions", { json: payload }).json<TransactionDto>();
  },
  getAccounts: async () => {
    return http.get("api/cashflow/accounts").json<AccountDto[]>();
  },
  getCategories: async () => {
    return http.get("api/cashflow/categories").json<CategoryDto[]>();
  },
};
