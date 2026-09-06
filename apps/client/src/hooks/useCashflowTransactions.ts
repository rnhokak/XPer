import { useApiQuery, useApiMutation, useApiCache } from '@/lib/query'
import { type CategoryFocus } from '@/lib/validation/categories'
import { type CashflowTransactionType } from '@/lib/validation/cashflow'
import { normalizeCashflowRange, normalizeRangeShift, rangeBounds } from '@/lib/cashflow/utils'
import {
  getTransactions,
  getReportTransactions,
  getAccounts,
  getCategories,
  createAccount,
  updateAccount,
  deleteAccount,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/api/cashflow'
import db from '@/lib/db'
import { type CashflowQuickAddValues } from '@/lib/validation/cashflow'
import { type AccountInput } from '@/lib/validation/accounts'
import { type CategoryInput } from '@/lib/validation/categories'
import { enqueueOperation } from '@/lib/sync/syncService'

export type CashflowTransaction = {
  id: string
  type: CashflowTransactionType
  amount: number
  currency: string
  note: string | null
  transaction_time: string
  category: { id: string | null; name: string | null; type: CashflowTransactionType | 'debt' } | null
  account: { id: string | null; name: string | null; currency: string | null } | null
  user_id: string
  pending?: boolean
  error?: boolean
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
  type: 'income' | 'expense' | 'transfer' | 'debt'
  parent_id: string | null
  level: 0 | 1 | 2
  category_focus: CategoryFocus | null
  is_default: boolean | null
  user_id: string
}

export const cashflowTransactionsQueryKey = (range: string, shift: number) => ['cashflow-transactions', range, shift]

const isCurrentMonthQuery = (range: string, shift: number) => normalizeCashflowRange(range) === 'month' && normalizeRangeShift(String(shift)) === 0

const getLocalTransactionsForRange = async (range: string, shift: number) => {
  const bounds = rangeBounds(normalizeCashflowRange(range), normalizeRangeShift(String(shift)))
  const localTransactions = await db.transactions.toArray() as unknown as CashflowTransaction[]
  return localTransactions.filter((transaction) => {
    const time = new Date(transaction.transaction_time).getTime()
    return !Number.isNaN(time) && time >= bounds.start.getTime() && time < bounds.end.getTime()
  }) as CashflowTransaction[]
}

const getAndCacheCurrentMonthTransactions = async () => {
  try {
    const remoteTransactions = await getTransactions('month', 0)
    const currentLocalTransactions = await getLocalTransactionsForRange('month', 0)
    const pendingTransactions = currentLocalTransactions.filter((transaction) => transaction.pending)
    const pendingIds = new Set(pendingTransactions.map((transaction) => transaction.id))
    const cachedTransactions = remoteTransactions.filter((transaction) => !pendingIds.has(transaction.id))
    const remoteIds = new Set(remoteTransactions.map((transaction) => transaction.id))
    const staleIds = currentLocalTransactions
      .filter((transaction) => !transaction.pending && !remoteIds.has(transaction.id))
      .map((transaction) => transaction.id)
    if (staleIds.length > 0) await db.transactions.bulkDelete(staleIds)
    await db.transactions.bulkPut(cachedTransactions)
    return [...pendingTransactions, ...cachedTransactions]
  } catch (error) {
    const localTransactions = await getLocalTransactionsForRange('month', 0)
    if (localTransactions.length > 0) return localTransactions
    throw error
  }
}

export function useCashflowTransactions(range: string, shift: number, initialData?: CashflowTransaction[]) {
  const normalizedRange = normalizeCashflowRange(range)
  const normalizedShift = normalizeRangeShift(String(shift))

  return useApiQuery({
    queryKey: cashflowTransactionsQueryKey(normalizedRange, normalizedShift),
    queryFn: () => isCurrentMonthQuery(normalizedRange, normalizedShift)
      ? getAndCacheCurrentMonthTransactions()
      : getTransactions(normalizedRange, normalizedShift),
    initialData: initialData ?? undefined,
  })
}

export const cashflowReportTransactionsQueryKey = ['cashflow-report-transactions']

export function useCashflowReportTransactions() {
  return useApiQuery({
    queryKey: cashflowReportTransactionsQueryKey,
    queryFn: getReportTransactions,
  })
}

export function useCashflowAccounts() {
  return useApiQuery({
    queryKey: ['cashflow-accounts'],
    queryFn: getAccounts,
  })
}

export function useCashflowCategories() {
  return useApiQuery({
    queryKey: ['cashflow-categories'],
    queryFn: getCategories,
  })
}

// Mutation hooks for transactions
const toLocalTransactionRecord = (values: CashflowQuickAddValues, tmpId: string) => ({
  id: tmpId,
  type: values.type,
  amount: values.amount,
  currency: values.currency ?? 'VND',
  note: values.note ?? null,
  transaction_time: values.transaction_time ?? new Date().toISOString(),
  category: values.category_id ? { id: values.category_id, name: null, type: values.type } : null,
  account: values.account_id ? { id: values.account_id, name: null, currency: values.currency ?? 'VND' } : null,
  user_id: 'local',
  pending: true,
})

const enqueueTransactionOperation = (op: Parameters<typeof enqueueOperation>[0]) => {
  return enqueueOperation(op)
}

export function useCreateTransaction() {
  return useApiMutation({
    mutationFn: async (values: CashflowQuickAddValues) => {
      const tmpId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const localTx = toLocalTransactionRecord(values, tmpId)

      await db.transactions.put(localTx)
      await enqueueTransactionOperation({
        resource: 'cashflow/transactions',
        opType: 'create',
        body: { ...values, __localId: tmpId },
      })

      return localTx
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useApiCache()
  return useApiMutation({
    mutationFn: async ({ id, values }: { id: string; values: CashflowQuickAddValues }) => {
      const current = await db.transactions.get(id)
      await db.transactions.put({ ...(current || {}), ...values, id, pending: true, error: false, updatedAt: Date.now() })
      await enqueueTransactionOperation({
        resource: 'cashflow/transactions',
        opType: 'update',
        body: { id, ...values },
      })

      return { id, ...values, pending: true }
    },
    onMutate: async ({ id, values }: { id: string; values: CashflowQuickAddValues }) => {
      await queryClient.cancelQueries({ queryKey: ['cashflow-transactions'] })
      queryClient.setQueriesData({ queryKey: ['cashflow-transactions'] }, (old: any) => {
        if (!Array.isArray(old)) return old
        return old.map((transaction) =>
          transaction.id === id
            ? { ...transaction, ...values, pending: true }
            : transaction,
        )
      })
      return { id }
    },
    onError: async (_err, _vars, context: any) => {
      if (context?.id) {
        try {
          await db.transactions.update(context.id, { pending: false, error: true })
        } catch {}
      }
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useApiCache()
  return useApiMutation({
    mutationFn: async (id: string) => {
      await db.transactions.delete(id)
      await enqueueTransactionOperation({
        resource: 'cashflow/transactions',
        opType: 'delete',
        body: { id },
      })

      return { id, success: true }
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['cashflow-transactions'] })
      queryClient.setQueriesData({ queryKey: ['cashflow-transactions'] }, (old: any) => {
        if (!Array.isArray(old)) return old
        return old.filter((transaction) => transaction.id !== id)
      })
      return { id }
    },
  })
}

// Mutation hooks for accounts
export function useCreateAccount() {
  const queryClient = useApiCache()
  return useApiMutation({
    mutationFn: (values: AccountInput) => createAccount(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useApiCache()
  return useApiMutation({
    mutationFn: ({ id, values }: { id: string; values: AccountInput }) =>
      updateAccount(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] })
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useApiCache()
  return useApiMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] })
    },
  })
}

// Mutation hooks for categories
export function useCreateCategory() {
  const queryClient = useApiCache()
  return useApiMutation({
    mutationFn: (values: CategoryInput) => createCategory(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-categories'] })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useApiCache()
  return useApiMutation({
    mutationFn: ({ id, values }: { id: string; values: CategoryInput }) =>
      updateCategory(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-categories'] })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useApiCache()
  return useApiMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade?: boolean }) =>
      deleteCategory(id, cascade),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-categories'] })
    },
  })
}
