/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: any[]
}

/* Service Worker with Workbox Background Sync & Offline Support
   - Precaches app shell (HTML, CSS, JS, Assets)
   - Handles SPA NavigationRoute fallback to index.html when offline
   - Uses NetworkFirst strategy for GET `/api/*` requests
   - Uses NetworkOnly with BackgroundSyncPlugin for non-GET `/api/*` requests
*/

import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

// Activate immediately
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
self.skipWaiting()
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
self.addEventListener('activate', (event: any) => event.waitUntil(self.clients.claim()))

// SPA Navigation route fallback: serve /app/index.html for offline navigations
try {
  const handler = createHandlerBoundToURL('/app/index.html')
  const navigationRoute = new NavigationRoute(handler, {
    denylist: [/^\/api\//],
  })
  registerRoute(navigationRoute)
} catch (err) {
  console.error('Failed to register navigation route in SW', err)
}

// Never cache version.json: always fetch directly from network
registerRoute(
  ({ url }) => url.pathname.endsWith('/version.json'),
  new NetworkOnly(),
)

// Runtime caching for GET API requests (NetworkFirst with cache fallback)
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'xper-api-get-cache',
    networkTimeoutSeconds: 3,
  }),
)

const bgSyncPlugin = new BackgroundSyncPlugin('xper-queue', {
  maxRetentionTime: 24 * 60, // Retry for max of 24 hours (in minutes)
  onSync: async ({ queue }) => {
    const all = await self.clients.matchAll({ includeUncontrolled: true })
    for (const client of all) {
      client.postMessage({ type: 'xper:sw-sync-start' })
    }
    try {
      await queue.replayRequests()
    } catch {
      // let Workbox handle retries
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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (self.registration && 'sync' in self.registration) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      self.registration.sync.register('xper-sync').catch(() => {})
    }
  }

  if (data && data.type === 'xper:clear-api-cache') {
    caches.delete('xper-api-get-cache').catch(() => {})
  }

  if (data && data.type === 'xper:clear-all-caches') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {})
  }

  if (data && data.type === 'SKIP_WAITING') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    self.skipWaiting()
  }
})

export {}
