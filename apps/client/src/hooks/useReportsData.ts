import { useApiQuery } from '@/lib/query'
import { rangeBounds, type CashflowRange } from '@/lib/cashflow/utils'
import db from '@/lib/db'
import { getCategories, getTransactions } from '@/lib/api/cashflow'
import { type CashflowTransaction } from '@/hooks/useCashflowTransactions'

export type Account = {
  id: string
  name: string
  currency: string
  type?: string | null
  is_default?: boolean | null
}

export type Category = {
  id: string
  name: string
  type: 'income' | 'expense' | 'transfer'
  parent_id: string | null
  is_default?: boolean | null
  category_focus: string | null
}

export type Transaction = {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  note: string | null
  transaction_time: string
  category_id: string | null
  account_id: string | null
}

export const getReportsDataFromLocalDb = async (range: CashflowRange, shift: number) => {
  const bounds = rangeBounds(range, shift)

  // 1. Ensure categories are available in local DB
  let localCategories = await db.categories.toArray()
  if (localCategories.length === 0) {
    try {
      const remoteCategories = await getCategories()
      await db.categories.bulkPut(remoteCategories)
      localCategories = await db.categories.toArray()
    } catch {
      // Offline: proceed with whatever is stored in local db
    }
  }

  // 2. Try fetching latest transactions for the range to cache into local DB
  try {
    const remoteTransactions = await getTransactions(range, shift)
    const currentLocalTransactions = (await db.transactions.toArray()) as unknown as CashflowTransaction[]
    const pendingOps = await db.pending.toArray()
    const pendingOpIds = new Set(
      pendingOps.map((op) => op.body?.__localId || op.body?.id).filter(Boolean)
    )

    // Clean up local pending transactions that are no longer pending
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
    const remoteToCache = remoteTransactions.filter((transaction) => !pendingIds.has(transaction.id))
    if (remoteToCache.length > 0) {
      await db.transactions.bulkPut(remoteToCache)
    }
  } catch {
    // Offline or network error: continue reading from local DB
  }

  // 3. Query all matching transactions from local DB
  const allLocalTransactions = (await db.transactions.toArray()) as unknown as CashflowTransaction[]

  const transactions: Transaction[] = allLocalTransactions
    .filter((tx) => {
      if (tx.type !== 'expense') return false
      const time = new Date(tx.transaction_time).getTime()
      return !Number.isNaN(time) && time >= bounds.start.getTime() && time < bounds.end.getTime()
    })
    .map((tx) => ({
      id: tx.id,
      type: tx.type as 'income' | 'expense' | 'transfer',
      amount: Math.abs(tx.amount),
      currency: tx.currency ?? 'VND',
      note: tx.note ?? null,
      transaction_time: tx.transaction_time,
      category_id: (tx as any).category_id ?? tx.category?.id ?? null,
      account_id: (tx as any).account_id ?? tx.account?.id ?? null,
    }))

  const categories: Category[] = localCategories
    .filter((cat) => cat.type === 'expense')
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      type: 'expense' as const,
      parent_id: cat.parent_id ?? null,
      is_default: Boolean(cat.is_default),
      category_focus: cat.category_focus ?? null,
    }))

  return {
    accounts: [] as Account[],
    categories,
    transactions,
  }
}

export function useReportsData(range: CashflowRange, shift: number, userId?: string) {
  return useApiQuery({
    queryKey: ['reports', range, shift, userId ?? ''],
    queryFn: () => getReportsDataFromLocalDb(range, shift),
  })
}
