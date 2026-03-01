import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type CategoryFocus } from '@/lib/validation/categories'
import { type CashflowTransactionType } from '@/lib/validation/cashflow'
import { normalizeCashflowRange, normalizeRangeShift } from '@/lib/cashflow/utils'
import {
  getTransactions,
  getReportTransactions,
  getAccounts,
  getCategories,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createAccount,
  updateAccount,
  deleteAccount,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/api/cashflow'
import { type CashflowQuickAddValues } from '@/lib/validation/cashflow'
import { type AccountInput } from '@/lib/validation/accounts'
import { type CategoryInput } from '@/lib/validation/categories'

export type CashflowTransaction = {
  id: string
  type: CashflowTransactionType
  amount: number
  currency: string
  note: string | null
  transaction_time: string
  category: { id: string | null; name: string | null; type: CashflowTransactionType } | null
  account: { id: string | null; name: string | null; currency: string | null } | null
  user_id: string
}

export type CashflowAccount = {
  id: string
  name: string
  type: string | null
  currency: string
  is_default: boolean | null
  user_id: string
}

export type CashflowCategory = {
  id: string
  name: string
  type: 'income' | 'expense' | 'transfer'
  parent_id: string | null
  level: 0 | 1 | 2
  category_focus: CategoryFocus | null
  is_default: boolean | null
  user_id: string
}

export const cashflowTransactionsQueryKey = (range: string, shift: number) => ['cashflow-transactions', range, shift]

export function useCashflowTransactions(range: string, shift: number, initialData?: CashflowTransaction[]) {
  const normalizedRange = normalizeCashflowRange(range)
  const normalizedShift = normalizeRangeShift(String(shift))

  return useQuery({
    queryKey: cashflowTransactionsQueryKey(normalizedRange, normalizedShift),
    queryFn: () => getTransactions(normalizedRange, normalizedShift),
    initialData: initialData ?? undefined,
  })
}

export const cashflowReportTransactionsQueryKey = ['cashflow-report-transactions']

export function useCashflowReportTransactions() {
  return useQuery({
    queryKey: cashflowReportTransactionsQueryKey,
    queryFn: getReportTransactions,
  })
}

export function useCashflowAccounts() {
  return useQuery({
    queryKey: ['cashflow-accounts'],
    queryFn: getAccounts,
  })
}

export function useCashflowCategories() {
  return useQuery({
    queryKey: ['cashflow-categories'],
    queryFn: getCategories,
  })
}

// Mutation hooks for transactions
export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-transactions'] })
      queryClient.invalidateQueries({ queryKey: cashflowReportTransactionsQueryKey })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CashflowQuickAddValues }) =>
      updateTransaction(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-transactions'] })
      queryClient.invalidateQueries({ queryKey: cashflowReportTransactionsQueryKey })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-transactions'] })
      queryClient.invalidateQueries({ queryKey: cashflowReportTransactionsQueryKey })
    },
  })
}

// Mutation hooks for accounts
export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: AccountInput) => createAccount(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: AccountInput }) =>
      updateAccount(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] })
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] })
    },
  })
}

// Mutation hooks for categories
export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: CategoryInput) => createCategory(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-categories'] })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CategoryInput }) =>
      updateCategory(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-categories'] })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade?: boolean }) =>
      deleteCategory(id, cascade),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-categories'] })
    },
  })
}
