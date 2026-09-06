import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { MoneyVisibilityProvider } from './components/providers/MoneyVisibilityProvider'
import { Notifications } from './components/ui/notifications'
import { Button } from './components/ui/button'
import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type UpdateAvailableDetail = {
  update: () => Promise<void> | undefined
}

function UpdateAvailable() {
  const [update, setUpdate] = useState<UpdateAvailableDetail['update'] | null>(null)

  useEffect(() => {
    const onUpdateAvailable = (event: Event) => {
      setUpdate((event as CustomEvent<UpdateAvailableDetail>).detail.update)
    }

    window.addEventListener('xper:pwa-update-available', onUpdateAvailable)
    return () => window.removeEventListener('xper:pwa-update-available', onUpdateAvailable)
  }, [])

  if (!update) return null

  return (
    <div className="fixed inset-x-3 bottom-4 z-[10000] mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xl sm:inset-x-auto sm:right-5 sm:bottom-6">
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900">Có phiên bản mới</p>
        <p className="text-sm text-slate-600">Cập nhật để sử dụng phiên bản mới nhất.</p>
      </div>
      <Button
        size="sm"
        onClick={() => {
          void update()
          setUpdate(null)
        }}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Cập nhật
      </Button>
      <button
        type="button"
        onClick={() => setUpdate(null)}
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        aria-label="Đóng thông báo phiên bản mới"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function App() {
  return (
    <>
      <MoneyVisibilityProvider />
      <RouterProvider router={router} />
      <Notifications />
      <UpdateAvailable />
    </>
  )
}

export default App
