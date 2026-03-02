import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { DebtQuickCreateForm } from './components/DebtQuickCreateForm'
import { useAuth } from '@/hooks/useAuth'
import { useDebtsFormData } from '@/hooks/useDebtsData'

export default function DebtsNewPage() {
  const { user, loading: authLoading } = useAuth()
  const { data, isLoading, error } = useDebtsFormData(user?.id ?? '')

  if (authLoading || isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        Failed to load debts form data. Please try again.
      </div>
    )
  }

  const partners = data?.partners ?? []
  const accounts = data?.accounts ?? []
  const categories = data?.categories ?? []
  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null
  const defaultCurrency = defaultAccount?.currency ?? 'VND'

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Tạo khoản vay mới</p>
          <h1 className="text-2xl font-semibold">Debts</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/debts">Quay lại</Link>
        </Button>
      </div>

      <DebtQuickCreateForm
        partners={partners}
        accounts={accounts}
        categories={categories}
        defaultAccountId={defaultAccount?.id}
        defaultCurrency={defaultCurrency}
      />
    </div>
  )
}
