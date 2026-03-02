import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { rangeBounds, type CashflowRange } from '@/lib/cashflow/utils'

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
  const { start, end } = rangeBounds(range, shift)

  return useQuery({
    queryKey: ['reports', range, shift, userId],
    queryFn: async () => {
      const [accountsRes, categoriesRes, transactionsRes] = await Promise.all([
        supabase
          .from('accounts')
          .select('id,name,type,currency,is_default')
          .eq('user_id', userId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('categories')
          .select('id,name,type,parent_id,is_default,category_focus')
          .eq('user_id', userId)
          .eq('type', 'expense')
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('id,type,amount,currency,note,transaction_time,category_id,account_id')
          .eq('user_id', userId)
          .eq('type', 'expense')
          .gte('transaction_time', start.toISOString())
          .lt('transaction_time', end.toISOString())
          .order('transaction_time', { ascending: false }),
      ])

      if (accountsRes.error) throw accountsRes.error
      if (categoriesRes.error) throw categoriesRes.error
      if (transactionsRes.error) throw transactionsRes.error

      return {
        accounts: (accountsRes.data ?? []) as Account[],
        categories: (categoriesRes.data ?? []) as Category[],
        transactions: (transactionsRes.data ?? []) as Transaction[],
      }
    },
    enabled: Boolean(userId),
  })
}
