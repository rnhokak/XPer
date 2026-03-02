import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { PartnersManager } from './components/PartnersManager'
import { useAuth } from '@/hooks/useAuth'
import { useDebtPartners } from '@/hooks/useDebtsData'

export default function DebtsPartnersPage() {
  const { user, loading: authLoading } = useAuth()
  const { data: partners = [], isLoading, error } = useDebtPartners(user?.id ?? '')

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
        Failed to load partners. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Quản lý người/đơn vị liên quan tới khoản vay</p>
          <h1 className="text-2xl font-semibold">Đối tác</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/debts">Quay lại Debts</Link>
        </Button>
      </div>

      <PartnersManager partners={partners} />
    </div>
  )
}
