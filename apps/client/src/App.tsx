import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { QueryProvider } from './components/providers/QueryProvider'
import { MoneyVisibilityProvider } from './components/providers/MoneyVisibilityProvider'

function App() {
  return (
    <QueryProvider>
      <MoneyVisibilityProvider />
      <RouterProvider router={router} />
    </QueryProvider>
  )
}

export default App
