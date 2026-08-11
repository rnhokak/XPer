import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { QueryProvider } from './components/providers/QueryProvider'
import { MoneyVisibilityProvider } from './components/providers/MoneyVisibilityProvider'
import { Notifications } from './components/ui/notifications'

function App() {
  return (
    <QueryProvider>
      <MoneyVisibilityProvider />
      <RouterProvider router={router} />
      <Notifications />
    </QueryProvider>
  )
}

export default App
