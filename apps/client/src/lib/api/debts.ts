import { apiClient } from './client'
import { type DebtRow, type Partner, type Account, type Category, type DebtDetailPaymentRow } from '@/hooks/useDebtsData'

export async function getDebts(): Promise<DebtRow[]> {
  const response = await apiClient.get<DebtRow[]>('/debts')
  return response.data
}

export async function getDebtPartners(): Promise<Partner[]> {
  const response = await apiClient.get<Partner[]>('/debts/partners')
  return response.data
}

export async function getDebtDetail(debtId: string): Promise<{
  debt: DebtRow | null
  payments: DebtDetailPaymentRow[]
  accounts: Account[]
  categories: Category[]
}> {
  const response = await apiClient.get(`/debts/${debtId}`)
  return response.data
}
