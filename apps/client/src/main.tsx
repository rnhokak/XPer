import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.tailwind.css'
import { registerSW } from 'virtual:pwa-register'
import { startSyncListeners } from '@/lib/sync/syncService'

if (!import.meta.env.DEV) {
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(
        new CustomEvent('xper:pwa-update-available', {
          detail: { update: () => updateSW?.(true) },
        }),
      )
    },
    onOfflineReady() {
      console.info('PWA app is ready to work offline.')
    },
  })
}
// start background/foreground sync listeners
startSyncListeners()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
