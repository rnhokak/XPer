import { apiClient } from '@/lib/api/client'
import db, { PendingOp } from '@/lib/db'
import { useApiCache } from '@/lib/query'
import { getStoredUser } from '@/store/auth'
import { getAccounts, getCategories, getReportTransactions } from '@/lib/api/cashflow'
import { getDebts, getDebtPartners } from '@/lib/api/debts'

const PROCESSING_KEY = 'sync:processing'
const PROCESS_AGAIN_KEY = 'sync:process-again'
export const LAST_SYNC_KEY = 'xper:last_sync_time'
export const SYNC_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes
const SYNC_RUNNING_KEY = 'sync:running'

function syncCashflowQueries(op: PendingOp, serverData?: any) {
  if (op.resource !== 'cashflow/transactions') return

  const body = op.body || {}
  const syncedId = op.opType === 'create' ? body.__localId : body.id
  if (!syncedId) return

  const queryClient = useApiCache()

  queryClient.setQueriesData<any>(
    { queryKey: ['cashflow-transactions'] },
    (prev) => {
      if (!Array.isArray(prev)) return prev
      if (op.opType === 'delete') {
        return prev.filter((tx) => tx.id !== syncedId)
      }
      return prev.map((tx) =>
        tx.id === syncedId
          ? { ...tx, ...(serverData ?? {}), pending: false, error: false }
          : tx,
      )
    },
  )

  queryClient.setQueriesData<any>(
    { queryKey: ['cashflow-report-transactions'] },
    (prev) => {
      if (!Array.isArray(prev)) return prev
      if (op.opType === 'delete') {
        return prev.filter((tx) => tx.id !== syncedId)
      }
      return prev.map((tx) =>
        tx.id === syncedId
          ? { ...tx, ...(serverData ?? {}), pending: false, error: false }
          : tx,
      )
    },
  )

  void queryClient.invalidateQueries({ queryKey: ['cashflow-transactions'] })
  void queryClient.invalidateQueries({ queryKey: ['cashflow-report-transactions'] })
  void queryClient.invalidateQueries({ queryKey: ['reports'] })
  void queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] })
  void queryClient.invalidateQueries({ queryKey: ['debts'] })
}

export async function enqueueOperation(op: Omit<PendingOp, 'id' | 'createdAt' | 'tries'>) {
  const item: PendingOp = { ...op, createdAt: Date.now(), tries: 0 }
  await db.pending.add(item)
  window.dispatchEvent(new CustomEvent('xper:sync:queued'))
  if (navigator.onLine) {
    window.setTimeout(() => void processQueue().catch(() => {}), 0)
  }
  // Try to register background sync (best-effort). SW will message client on sync event.
  try {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      void navigator.serviceWorker.ready
        .then((reg) => reg.sync.register('xper-sync'))
        .catch(() => {})
    } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // fallback: postMessage to SW to ask for immediate attempt
      navigator.serviceWorker.controller.postMessage({ type: 'xper:trySync' })
    }
  } catch {
    // ignore registration errors
  }
}

async function handleCashflowTransactionSync(op: PendingOp, response?: any) {
  const body = op.body || {}
  const localId = body.__localId || body.id
  const peerLocalId = body.__peerLocalId

  if (op.opType === 'create') {
    if (localId) {
      await db.transactions.delete(localId)
    }
    if (peerLocalId) {
      await db.transactions.delete(peerLocalId)
    }
    if (response?.data) {
      if (Array.isArray(response.data)) {
        await db.transactions.bulkPut(response.data.map((tx: any) => ({ ...tx, pending: false, error: false })))
      } else {
        await db.transactions.put({ ...response.data, pending: false, error: false })
      }
    }
    return
  }

  if (op.opType === 'update') {
    const id = body.id
    if (id) {
      const current = await db.transactions.get(id)
      await db.transactions.put({ ...(current || {}), ...body, id, pending: false, error: false })
    }
    return
  }

  if (op.opType === 'delete') {
    if (body.id) {
      const current = await db.transactions.get(body.id)
      const ids = [body.id]
      if (current?.transfer_peer_id) ids.push(current.transfer_peer_id)
      if (response?.data?.deletedIds && Array.isArray(response.data.deletedIds)) {
        ids.push(...response.data.deletedIds)
      }
      await db.transactions.bulkDelete(ids)
    }
  }
}

async function sendOp(op: PendingOp) {
  const path = `/${op.resource}`

  try {
    if (op.opType === 'create') {
      const response = await apiClient.post(path, op.body)
      await handleCashflowTransactionSync(op, response)
      return response
    }

    if (op.opType === 'update') {
      const response = await apiClient.put(path, op.body)
      await handleCashflowTransactionSync(op, response)
      return response
    }

    if (op.opType === 'delete') {
      const response = await apiClient.delete(path, { data: op.body })
      await handleCashflowTransactionSync(op, response)
      return response
    }

    return undefined
  } catch (err) {
    throw err
  }
}

export async function processQueue({ limit = 20 } = {}) {
  if ((window as any)[PROCESSING_KEY]) {
    ;(window as any)[PROCESS_AGAIN_KEY] = true
    return
  }
  ;(window as any)[PROCESSING_KEY] = true
  try {
    const items = await db.pending.orderBy('createdAt').limit(limit).toArray()
    for (const item of items) {
      try {
        const response = await sendOp(item)
        await db.pending.delete(item.id!)
        syncCashflowQueries(item, response?.data)
        window.dispatchEvent(
          new CustomEvent('xper:sync:processed', {
            detail: { id: item.id, operation: item, data: response?.data },
          }),
        )
      } catch (err) {
        await db.pending.update(item.id!, { tries: (item.tries || 0) + 1 })
      }
    }
  } finally {
    const processAgain = Boolean((window as any)[PROCESS_AGAIN_KEY])
    ;(window as any)[PROCESS_AGAIN_KEY] = false
    ;(window as any)[PROCESSING_KEY] = false
    if (processAgain && navigator.onLine) {
      void processQueue({ limit }).catch(() => {})
    }
  }
}

export async function syncLocalDatabase({ force = false } = {}) {
  if (typeof window === 'undefined') return { skipped: true, reason: 'no_window' }
  if (!navigator.onLine) return { skipped: true, reason: 'offline' }

  const user = getStoredUser()
  if (!user) return { skipped: true, reason: 'unauthenticated' }

  if (!force) {
    const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY)
    const lastSyncTime = lastSyncStr ? parseInt(lastSyncStr, 10) : 0
    const elapsed = Date.now() - lastSyncTime
    if (elapsed < SYNC_INTERVAL_MS) {
      return { skipped: true, reason: 'interval_not_elapsed', elapsed }
    }
  }

  if ((window as any)[SYNC_RUNNING_KEY]) {
    return { skipped: true, reason: 'already_running' }
  }
  ;(window as any)[SYNC_RUNNING_KEY] = true

  try {
    // 1. Process pending outgoing mutations first
    await processQueue()

    // 2. Fetch fresh resources in parallel
    const [accountsRes, categoriesRes, debtPartnersRes, debtsRes, reportTxRes] = await Promise.allSettled([
      getAccounts(),
      getCategories(),
      getDebtPartners(),
      getDebts(),
      getReportTransactions(),
    ])

    // Update Accounts in local DB
    if (accountsRes.status === 'fulfilled' && Array.isArray(accountsRes.value)) {
      await db.accounts.clear()
      if (accountsRes.value.length > 0) {
        await db.accounts.bulkPut(accountsRes.value)
      }
    }

    // Update Categories in local DB
    if (categoriesRes.status === 'fulfilled' && Array.isArray(categoriesRes.value)) {
      await db.categories.clear()
      if (categoriesRes.value.length > 0) {
        await db.categories.bulkPut(categoriesRes.value)
      }
    }

    // Update Debt Partners in local DB
    if (debtPartnersRes.status === 'fulfilled' && Array.isArray(debtPartnersRes.value)) {
      await db.debtPartners.clear()
      if (debtPartnersRes.value.length > 0) {
        await db.debtPartners.bulkPut(debtPartnersRes.value)
      }
    }

    // Update Debts in local DB
    if (debtsRes.status === 'fulfilled' && Array.isArray(debtsRes.value)) {
      await db.debts.clear()
      if (debtsRes.value.length > 0) {
        await db.debts.bulkPut(debtsRes.value)
      }
    }

    // Update Transactions in local DB while preserving pending items
    if (reportTxRes.status === 'fulfilled' && Array.isArray(reportTxRes.value)) {
      const remoteTransactions = reportTxRes.value
      const pendingOps = await db.pending.toArray()
      const pendingOpIds = new Set(
        pendingOps.map((op) => op.body?.__localId || op.body?.id).filter(Boolean)
      )
      const currentLocalTransactions = await db.transactions.toArray()
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
          .filter((tx) => tx.pending && pendingOpIds.has(tx.id))
          .map((tx) => tx.id)
      )
      const remoteIds = new Set(remoteTransactions.map((tx) => tx.id))
      const staleIds = currentLocalTransactions
        .filter((tx) => !tx.pending && !remoteIds.has(tx.id) && !pendingOpIds.has(tx.id))
        .map((tx) => tx.id)
      if (staleIds.length > 0) {
        await db.transactions.bulkDelete(staleIds)
      }
      const remoteToCache = remoteTransactions.filter((tx) => !pendingIds.has(tx.id))
      if (remoteToCache.length > 0) {
        await db.transactions.bulkPut(remoteToCache)
      }
    }

    // Save sync timestamp
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString())

    // Invalidate React Query caches so UI re-reads from the updated local DB
    const queryClient = useApiCache()
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['cashflow-transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['cashflow-report-transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['cashflow-accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['cashflow-categories'] }),
      queryClient.invalidateQueries({ queryKey: ['debts'] }),
      queryClient.invalidateQueries({ queryKey: ['debt-partners'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ])

    window.dispatchEvent(
      new CustomEvent('xper:sync:completed', { detail: { timestamp: Date.now() } })
    )

    return { success: true }
  } catch (err) {
    console.warn('[SyncService] background sync failed:', err)
    return { success: false, error: err }
  } finally {
    ;(window as any)[SYNC_RUNNING_KEY] = false
  }
}

export function startSyncListeners() {
  // Run background sync on initial startup if > 2 minutes since last sync
  if (navigator.onLine) {
    void syncLocalDatabase().catch(() => {})
  }

  // Run when regained online
  window.addEventListener('online', () => {
    void processQueue().catch(() => {})
    void syncLocalDatabase().catch(() => {})
  })

  // Run when page becomes visible (e.g. reopening app or switching back to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void syncLocalDatabase().catch(() => {})
    }
  })

  // Listen for messages from service worker (sync event relay)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (ev: any) => {
      const data = ev.data || {}
      if (data && data.type === 'xper:sync') {
        void syncLocalDatabase({ force: true }).catch(() => {})
      }
    })
  }
}

export default { enqueueOperation, processQueue, syncLocalDatabase, startSyncListeners }
