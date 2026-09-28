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
import { type AccountInput, type UpdateAccountInput } from '@/lib/validation/accounts'
import { type CategoryInput } from '@/lib/validation/categories'
import { enqueueOperation } from '@/lib/sync/syncService'

export type CashflowTransaction = {
  id: string
  type: CashflowTransactionType
  flow_type?: boolean
  transfer_peer_id?: string | null
  amount: number
  currency: string
  note: string | null
  transaction_time: string
  category: { id: string | null; name: string | null; type: 'income' | 'expense' | string | null } | null
  category_id?: string | null
  account: { id: string | null; name: string | null; currency: string | null; type?: string | null } | null
  account_id?: string | null
  destination_account?: { id: string | null; name: string | null; currency: string | null; type?: string | null } | null
  destination_account_id?: string | null
  destination_amount?: number | null
  destination_currency?: string | null
  exchange_rate?: number | null
  user_id: string
  pending?: boolean
  error?: boolean
}

export type CashflowAccount = {
  id: string
  name: string
  type: string | null
  currency: string
  balance?: number | null
  is_default: boolean | null
  user_id: string
}

export type CashflowCategory = {
  id: string
  name: string
  type: 'income' | 'expense'
  parent_id: string | null
  level: 0 | 1 | 2
  category_focus: CategoryFocus | null
  is_default: boolean | null
  user_id: string
}

export const cashflowTransactionsQueryKey = (
  range: string,
  shift: number,
  customRange?: { from: string; to: string }
) =>
  customRange?.from && customRange?.to
    ? ['cashflow-transactions', 'custom', customRange.from, customRange.to]
    : ['cashflow-transactions', range, shift]

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
    const pendingOps = await db.pending.toArray()
    const pendingOpIds = new Set(
      pendingOps.map((op) => op.body?.__localId || op.body?.id).filter(Boolean)
    )

    // Clean up or resolve any local transactions that are marked pending but no longer in db.pending
    const resolvedLocalPending = currentLocalTransactions.filter(
      (tx) => tx.pending && !pendingOpIds.has(tx.id)
    )
    for (const tx of resolvedLocalPending) {
      if (tx.id.startsWith('local-')) {
        await db.transactions.delete(tx.id)
      } else {
        await db.transactions.update(tx.id, { pending: false, error: false })
      }
    }

    const pendingTransactions = currentLocalTransactions.filter(
      (transaction) => transaction.pending && pendingOpIds.has(transaction.id)
    )
    const pendingIds = new Set(pendingTransactions.map((transaction) => transaction.id))
    const cachedTransactions = remoteTransactions.filter((transaction) => !pendingIds.has(transaction.id))
    const remoteIds = new Set(remoteTransactions.map((transaction) => transaction.id))
    const staleIds = currentLocalTransactions
      .filter((transaction) => !transaction.pending && !remoteIds.has(transaction.id) && !pendingOpIds.has(transaction.id))
      .map((transaction) => transaction.id)
    if (staleIds.length > 0) await db.transactions.bulkDelete(staleIds)
    await db.transactions.bulkPut(cachedTransactions)
    return [...pendingTransactions, ...cachedTransactions]
  } catch (error) {
    const localTransactions = await getLocalTransactionsForRange('month', 0)
    return localTransactions
  }
}

const getTransactionsForRangeWithFallback = async (range: string, shift: number) => {
  try {
    const remoteTransactions = await getTransactions(range, shift)
    const pendingOps = await db.pending.toArray()
    const pendingOpIds = new Set(
      pendingOps.map((op) => op.body?.__localId || op.body?.id).filter(Boolean)
    )
    const remoteToCache = remoteTransactions.filter((tx) => !pendingOpIds.has(tx.id))
    if (remoteToCache.length > 0) {
      await db.transactions.bulkPut(remoteToCache)
    }
    return remoteTransactions
  } catch {
    const localTransactions = await getLocalTransactionsForRange(range, shift)
    return localTransactions
  }
}

const getReportTransactionsFromLocalDb = async () => {
  try {
    const remoteTransactions = await getReportTransactions()
    const currentLocalTransactions = await db.transactions.toArray() as unknown as CashflowTransaction[]
    const pendingOps = await db.pending.toArray()
    const pendingOpIds = new Set(
      pendingOps.map((op) => op.body?.__localId || op.body?.id).filter(Boolean)
    )

    const resolvedLocalPending = currentLocalTransactions.filter(
      (tx) => tx.pending && !pendingOpIds.has(tx.id)
    )
    for (const tx of resolvedLocalPending) {
      if (tx.id.startsWith('local-')) {
        await db.transactions.delete(tx.id)
      } else {
        await db.transactions.update(tx.id, { pending: false, error: false })
      }
    }

    const pendingIds = new Set(
      currentLocalTransactions
        .filter((transaction) => transaction.pending && pendingOpIds.has(transaction.id))
        .map((transaction) => transaction.id)
    )
    await db.transactions.bulkPut(remoteTransactions.filter((transaction) => !pendingIds.has(transaction.id)))
  } catch {
    // Continue with whatever is in local DB
  }

  return await db.transactions.toArray() as unknown as CashflowTransaction[]
}

const getTransactionsForCustomRangeWithFallback = async (from: string, to: string) => {
  try {
    const remoteTransactions = await getTransactions('custom', 0, { from, to })
    const pendingOps = await db.pending.toArray()
    const pendingOpIds = new Set(
      pendingOps.map((op) => op.body?.__localId || op.body?.id).filter(Boolean)
    )
    const remoteToCache = remoteTransactions.filter((tx) => !pendingOpIds.has(tx.id))
    if (remoteToCache.length > 0) {
      await db.transactions.bulkPut(remoteToCache)
    }
    return remoteTransactions
  } catch {
    const fromTime = new Date(`${from}T00:00:00`).getTime()
    const toTime = new Date(`${to}T23:59:59.999`).getTime()
    const localTransactions = (await db.transactions.toArray()) as unknown as CashflowTransaction[]
    return localTransactions.filter((tx) => {
      const time = new Date(tx.transaction_time).getTime()
      return !Number.isNaN(time) && time >= fromTime && time <= toTime
    })
  }
}

export function useCashflowTransactions(
  range: string,
  shift: number,
  initialData?: CashflowTransaction[],
  customRange?: { from: string; to: string }
) {
  const normalizedRange = normalizeCashflowRange(range)
  const normalizedShift = normalizeRangeShift(String(shift))
  const isCustom = Boolean(customRange?.from && customRange?.to)

  return useApiQuery({
    queryKey: cashflowTransactionsQueryKey(normalizedRange, normalizedShift, customRange),
    queryFn: () => {
      if (isCustom && customRange) {
        return getTransactionsForCustomRangeWithFallback(customRange.from, customRange.to)
      }
      return isCurrentMonthQuery(normalizedRange, normalizedShift)
        ? getAndCacheCurrentMonthTransactions()
        : getTransactionsForRangeWithFallback(normalizedRange, normalizedShift)
    },
    initialData: initialData ?? undefined,
  })
}

export const cashflowReportTransactionsQueryKey = ['cashflow-report-transactions']

export function useCashflowReportTransactions() {
  return useApiQuery({
    queryKey: cashflowReportTransactionsQueryKey,
    queryFn: getReportTransactionsFromLocalDb,
  })
}

export function useCashflowAccounts() {
  return useApiQuery({
    queryKey: ['cashflow-accounts'],
    queryFn: async () => {
      try {
        const accounts = await getAccounts()
        await db.accounts.bulkPut(accounts)
        return accounts
      } catch {
        const localAccounts = await db.accounts.toArray()
        return localAccounts as unknown as CashflowAccount[]
      }
    },
  })
}

export function useCashflowCategories() {
  return useApiQuery({
    queryKey: ['cashflow-categories'],
    queryFn: async () => {
      try {
        const categories = await getCategories()
        await db.categories.bulkPut(categories)
        return categories
      } catch {
        const localCategories = await db.categories.toArray()
        return localCategories as unknown as CashflowCategory[]
      }
    },
  })
}

// Mutation hooks for transactions
const toLocalTransactionRecord = (values: CashflowQuickAddValues, tmpId: string): CashflowTransaction => ({
  id: tmpId,
  type: values.type,
  flow_type: values.type === 'income',
  amount: values.amount,
  currency: values.currency ?? 'VND',
  note: values.note ?? null,
  transaction_time: values.transaction_time ?? new Date().toISOString(),
  category: values.category_id ? { id: values.category_id, name: null, type: values.type } : null,
  category_id: values.category_id ?? null,
  account: values.account_id ? { id: values.account_id, name: null, currency: values.currency ?? 'VND' } : null,
  account_id: values.account_id ?? null,
  destination_account: values.destination_account_id ? { id: values.destination_account_id, name: null, currency: values.destination_currency ?? null } : null,
  destination_account_id: values.destination_account_id ?? null,
  destination_amount: values.destination_amount ?? null,
  destination_currency: values.destination_currency ?? null,
  exchange_rate: values.exchange_rate ?? null,
  user_id: 'local',
  pending: true,
})

const enqueueTransactionOperation = (op: Parameters<typeof enqueueOperation>[0]) => {
  return enqueueOperation(op)
}

export function useCreateTransaction() {
  const queryClient = useApiCache()
  return useApiMutation({
    mutationFn: async (values: CashflowQuickAddValues) => {
      if (values.type === 'transfer') {
        const tmpId1 = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        const tmpId2 = `local-${Date.now() + 1}-${Math.random().toString(36).slice(2, 9)}`
        const destAmount = values.destination_amount ?? values.amount
        const destCurrency = values.destination_currency ?? values.currency ?? 'VND'

        const localTx1: CashflowTransaction = {
          id: tmpId1,
          type: 'transfer',
          flow_type: false, // giảm tiền tài khoản nguồn
          transfer_peer_id: tmpId2,
          amount: values.amount,
          currency: values.currency ?? 'VND',
          note: values.note ?? null,
          transaction_time: values.transaction_time ?? new Date().toISOString(),
          category: null,
          category_id: null,
          account: values.account_id ? { id: values.account_id, name: null, currency: values.currency ?? 'VND' } : null,
          account_id: values.account_id ?? null,
          destination_account: values.destination_account_id ? { id: values.destination_account_id, name: null, currency: destCurrency } : null,
          destination_account_id: values.destination_account_id ?? null,
          destination_amount: destAmount,
          destination_currency: destCurrency,
          exchange_rate: values.exchange_rate ?? null,
          user_id: 'local',
          pending: true,
        }

        const localTx2: CashflowTransaction = {
          id: tmpId2,
          type: 'transfer',
          flow_type: true, // tăng tiền tài khoản đích
          transfer_peer_id: tmpId1,
          amount: destAmount,
          currency: destCurrency,
          note: values.note ?? null,
          transaction_time: values.transaction_time ?? new Date().toISOString(),
          category: null,
          category_id: null,
          account: values.destination_account_id ? { id: values.destination_account_id, name: null, currency: destCurrency } : null,
          account_id: values.destination_account_id ?? null,
          destination_account: values.account_id ? { id: values.account_id, name: null, currency: values.currency ?? 'VND' } : null,
          destination_account_id: values.account_id ?? null,
          destination_amount: values.amount,
          destination_currency: values.currency ?? 'VND',
          exchange_rate: values.exchange_rate ?? null,
          user_id: 'local',
          pending: true,
        }

        await db.transactions.bulkPut([localTx1, localTx2])

        // Update local Dexie accounts balance: deduct source, add destination
        if (values.account_id) {
          const srcAcc = await db.accounts.get(values.account_id)
          if (srcAcc) {
            await db.accounts.update(values.account_id, {
              balance: (Number(srcAcc.balance) || 0) - values.amount,
            })
          }
        }
        if (values.destination_account_id) {
          const dstAcc = await db.accounts.get(values.destination_account_id)
          if (dstAcc) {
            await db.accounts.update(values.destination_account_id, {
              balance: (Number(dstAcc.balance) || 0) + destAmount,
            })
          }
        }

        await enqueueTransactionOperation({
          resource: 'cashflow/transactions',
          opType: 'create',
          body: { ...values, __localId: tmpId1, __peerLocalId: tmpId2 },
        })

        return localTx1
      }

      const tmpId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const localTx = toLocalTransactionRecord(values, tmpId)

      await db.transactions.put(localTx)

      // Update local Dexie account balance: deduct for expense, add for income
      if (values.account_id) {
        const acc = await db.accounts.get(values.account_id)
        if (acc) {
          const delta = values.type === 'income' ? values.amount : -values.amount
          await db.accounts.update(values.account_id, {
            balance: (Number(acc.balance) || 0) + delta,
          })
        }
      }

      await enqueueTransactionOperation({
        resource: 'cashflow/transactions',
        opType: 'create',
        body: { ...values, __localId: tmpId },
      })

      return localTx
    },
    onMutate: async (values: CashflowQuickAddValues) => {
      await queryClient.cancelQueries({ queryKey: ['cashflow-accounts'] })
      queryClient.setQueriesData({ queryKey: ['cashflow-accounts'] }, (old: any) => {
        if (!Array.isArray(old)) return old
        const destAmount = values.destination_amount ?? values.amount
        return old.map((acc: any) => {
          if (values.type === 'expense' && acc.id === values.account_id) {
            return { ...acc, balance: (Number(acc.balance) || 0) - values.amount }
          }
          if (values.type === 'income' && acc.id === values.account_id) {
            return { ...acc, balance: (Number(acc.balance) || 0) + values.amount }
          }
          if (values.type === 'transfer') {
            if (acc.id === values.account_id) {
              return { ...acc, balance: (Number(acc.balance) || 0) - values.amount }
            }
            if (acc.id === values.destination_account_id) {
              return { ...acc, balance: (Number(acc.balance) || 0) + destAmount }
            }
          }
          return acc
        })
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow-report-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['debts'] })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow-report-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['debts'] })
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
      const current = await db.transactions.get(id)
      const idsToDelete = [id]
      if (current?.transfer_peer_id) {
        idsToDelete.push(current.transfer_peer_id)
      }
      await db.transactions.bulkDelete(idsToDelete)
      await enqueueTransactionOperation({
        resource: 'cashflow/transactions',
        opType: 'delete',
        body: { id },
      })

      return { id, idsToDelete, success: true }
    },
    onMutate: async (id: string) => {
      const current = await db.transactions.get(id)
      const peerId = current?.transfer_peer_id
      await queryClient.cancelQueries({ queryKey: ['cashflow-transactions'] })
      queryClient.setQueriesData({ queryKey: ['cashflow-transactions'] }, (old: any) => {
        if (!Array.isArray(old)) return old
        return old.filter((transaction) => transaction.id !== id && transaction.id !== peerId)
      })
      return { id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow-report-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['debts'] })
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
    mutationFn: ({ id, values }: { id: string; values: UpdateAccountInput | Partial<AccountInput> }) =>
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
      queryClient.invalidateQueries({ queryKey: ['reports'] })
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
      queryClient.invalidateQueries({ queryKey: ['reports'] })
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
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
