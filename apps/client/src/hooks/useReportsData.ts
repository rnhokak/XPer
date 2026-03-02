import { useQuery } from '@tanstack/react-query'
import { getReportsData } from '@/lib/api/reports'
import { type CashflowRange } from '@/lib/cashflow/utils'

type Account = {
  id: string
  name: string
  currency: string
  type?: string | null
  is_default?: boolean | null
}

type Category = {
  id: string
  name: string
  type: 'income' | 'expense' | 'transfer'
  parent_id: string | null
  is_default?: boolean | null
  category_focus: string | null
}

type Transaction = {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  note: string | null
  transaction_time: string
  category_id: string | null
  account_id: string | null
}

export function useReportsData(range: CashflowRange, shift: number, userId: string) {
  return useQuery({
    queryKey: ['reports', range, shift, userId],
    queryFn: async () => {
      const data = await getReportsData(range, shift)
      return {
        accounts: (data.accounts ?? []) as Account[],
        categories: (data.categories ?? []) as Category[],
        transactions: (data.transactions ?? []) as Transaction[],
      }
    },
    enabled: Boolean(userId),
  })
}
