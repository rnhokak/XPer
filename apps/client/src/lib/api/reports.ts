import { apiClient } from './client'
import { type CashflowRange } from '@/lib/cashflow/utils'

export type ReportsResponse = {
  accounts: Array<{ id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null }>
  categories: Array<{
    id: string
    name: string
    type: 'income' | 'expense' | 'transfer'
    parent_id: string | null
    is_default?: boolean | null
    category_focus: string | null
  }>
  transactions: Array<{
    id: string
    type: 'income' | 'expense' | 'transfer'
    amount: number
    currency: string
    note: string | null
    transaction_time: string
    category_id: string | null
    account_id: string | null
  }>
}

export async function getReportsData(range: CashflowRange, shift: number): Promise<ReportsResponse> {
  const response = await apiClient.get<ReportsResponse>('/reports/transactions-by-category', {
    params: { range, shift },
  })
  return response.data
}
