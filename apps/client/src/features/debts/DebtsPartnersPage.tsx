import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Loader2, RotateCw } from 'lucide-react'
import { PartnersManager } from './components/PartnersManager'
import { useAuth } from '@/hooks/useAuth'
import { useDebtsFormData } from '@/hooks/useDebtsData'
import { cn } from '@/lib/utils'

export default function DebtsPartnersPage() {
  const { user, loading: authLoading } = useAuth()
  const { data, isLoading, error, refetch, isFetching } = useDebtsFormData(user?.id ?? '')

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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-xl border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all"
            title="Làm mới danh sách đối tác"
          >
            <RotateCw className={cn("h-4 w-4", isFetching && "animate-spin text-primary")} />
            <span>{isFetching ? "Đang làm mới..." : "Làm mới"}</span>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/debts">Quay lại Debts</Link>
          </Button>
        </div>
      </div>

      <PartnersManager
        partners={data?.partners ?? []}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />
    </div>
  )
}
