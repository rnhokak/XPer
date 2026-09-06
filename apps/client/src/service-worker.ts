/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: any[]
}

/* Service Worker with Workbox Background Sync
   - Uses workbox-routing + workbox-strategies + workbox-background-sync
   - Registers a NetworkOnly route for non-GET `/api/*` requests so Workbox can queue them when offline
   - Also listens for Background Sync `sync` events and relays a message to clients as a fallback
*/

import { registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

// Activate immediately
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
self.skipWaiting()
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
self.addEventListener('activate', (event: any) => event.waitUntil(self.clients.claim()))

const bgSyncPlugin = new BackgroundSyncPlugin('xper-queue', {
  maxRetentionTime: 24 * 60, // Retry for max of 24 hours (in minutes)
  onSync: async ({ queue }) => {
    // Optional: notify clients that SW is flushing its background queue
    const all = await self.clients.matchAll({ includeUncontrolled: true })
    for (const client of all) {
      client.postMessage({ type: 'xper:sw-sync-start' })
    }
    try {
      await queue.replayRequests()
    } catch (err) {
      // let Workbox handle retries; optionally notify clients
    }
    for (const client of all) {
      client.postMessage({ type: 'xper:sw-sync-complete' })
    }
  },
})

// Match non-GET API requests and use NetworkOnly with BackgroundSyncPlugin
registerRoute(
  ({ url, request }) => {
    return (
      url.pathname.startsWith('/api/') &&
      request.method !== 'GET' &&
      !url.pathname.endsWith('/cashflow/transactions')
    )
  },
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
)

// Fallback: listen for sync event and message clients
self.addEventListener('sync', (event: any) => {
  const tag = event.tag
  if (!tag) return
  if (tag === 'xper-sync') {
    event.waitUntil(
      (async () => {
        const all = await self.clients.matchAll({ includeUncontrolled: true })
        for (const client of all) {
          client.postMessage({ type: 'xper:sync' })
        }
      })(),
    )
  }
})

// Handle incoming messages from clients (optional hooks)
self.addEventListener('message', (ev: any) => {
  const data = ev.data || {}
  if (data && data.type === 'xper:trySync') {
    // try to register a sync on behalf of client (best-effort)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (self.registration && 'sync' in self.registration) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      self.registration.sync.register('xper-sync').catch(() => {})
    }
  }
})

export {}
