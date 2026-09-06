import { apiClient } from '@/lib/api/client'
import db, { PendingOp } from '@/lib/db'
import { useApiCache } from '@/lib/query'

const PROCESSING_KEY = 'sync:processing'
const PROCESS_AGAIN_KEY = 'sync:process-again'

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

  if (op.opType === 'create') {
    if (localId) {
      await db.transactions.delete(localId)
    }
    if (response?.data) {
      await db.transactions.put({ ...response.data, pending: false, error: false })
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
      await db.transactions.delete(body.id)
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

export function startSyncListeners() {
  // run when regained online or when page becomes visible
  window.addEventListener('online', () => void processQueue())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void processQueue()
  })
  // listen for messages from service worker (sync event relay)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (ev: any) => {
      const data = ev.data || {}
      if (data && data.type === 'xper:sync') void processQueue()
    })
  }
  // attempt initial run
  if (navigator.onLine) void processQueue()
}

export default { enqueueOperation, processQueue, startSyncListeners }
