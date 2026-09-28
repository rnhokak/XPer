import { apiClient } from './client'
import { type DebtRow, type Partner, type Account, type Category, type DebtDetailPaymentRow } from '@/hooks/useDebtsData'
import { type DebtCreateInput } from '@/lib/validation/debts'

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

export async function createDebt(payload: DebtCreateInput): Promise<{ success: boolean; debt_id: string; transaction?: any }> {
  const response = await apiClient.post('/debts', payload)
  return response.data
}

export async function createDebtPartner(name: string): Promise<{ success: boolean; partner?: Partner }> {
  const response = await apiClient.post('/debts/partners', { name })
  return response.data
}
