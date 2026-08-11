import { apiClient } from './client'
import { type CashflowTransaction, type CashflowAccount, type CashflowCategory } from '@/hooks/useCashflowTransactions'
import { type CashflowQuickAddValues } from '@/lib/validation/cashflow'
import { type AccountInput } from '@/lib/validation/accounts'
import { type CategoryInput } from '@/lib/validation/categories'

// Transactions API
export async function getTransactions(range: string, shift: number): Promise<CashflowTransaction[]> {
  const response = await apiClient.get<CashflowTransaction[]>('/cashflow/transactions', {
    params: { range, shift }
  })
  return response.data
}

export async function getReportTransactions(): Promise<CashflowTransaction[]> {
  const response = await apiClient.get<CashflowTransaction[]>('/cashflow/report-transactions')
  return response.data
}

export async function createTransaction(values: CashflowQuickAddValues): Promise<CashflowTransaction> {
  const response = await apiClient.post<CashflowTransaction>('/cashflow/transactions', values)
  return response.data
}

export async function updateTransaction(id: string, values: CashflowQuickAddValues): Promise<{ success: boolean }> {
  const response = await apiClient.put<{ success: boolean }>('/cashflow/transactions', { id, ...values })
  return response.data
}

export async function deleteTransaction(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete<{ success: boolean }>('/cashflow/transactions', {
    data: { id }
  })
  return response.data
}

// Accounts API
export async function getAccounts(): Promise<CashflowAccount[]> {
  const response = await apiClient.get<CashflowAccount[]>('/cashflow/accounts')
  return response.data
}

export async function createAccount(values: AccountInput): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>('/cashflow/accounts', values)
  return response.data
}

export async function updateAccount(id: string, values: AccountInput): Promise<{ success: boolean }> {
  const response = await apiClient.put<{ success: boolean }>('/cashflow/accounts', { id, ...values })
  return response.data
}

export async function deleteAccount(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete<{ success: boolean }>('/cashflow/accounts', {
    data: { id }
  })
  return response.data
}

// Categories API
export async function getCategories(): Promise<CashflowCategory[]> {
  const response = await apiClient.get<CashflowCategory[]>('/cashflow/categories')
  return response.data
}

export async function createCategory(values: CategoryInput): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>('/cashflow/categories', values)
  return response.data
}

export async function updateCategory(id: string, values: CategoryInput): Promise<{ success: boolean }> {
  const response = await apiClient.put<{ success: boolean }>('/cashflow/categories', { id, ...values })
  return response.data
}

export async function deleteCategory(id: string, cascade: boolean = false): Promise<{ success: boolean }> {
  const response = await apiClient.delete<{ success: boolean }>('/cashflow/categories', {
    data: { id, cascade }
  })
  return response.data
}
