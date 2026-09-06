import { apiClient } from './client'

export type LatestBalanceRow = {
  balance_account_id: string | null
  user_id: string
  account_type: 'TRADING' | 'FUNDING'
  name: string
  currency: string
  is_active: boolean
  current_balance: number | null
  balance_at: string | null
}

export type SnapshotRow = {
  id: string
  balance_account_id: string
  date: string
  opening_balance: number
  closing_balance: number
  created_at: string
}

export type BalanceAccount = {
  id: string
  account_type: 'TRADING' | 'FUNDING'
  name: string
  currency: string
  is_active: boolean
  created_at: string | null
  broker: string | null
  platform: string | null
  account_number: string | null
  is_demo: boolean | null
}

export type FundingRow = {
  id: string
  user_id: string
  balance_account_id: string
  type: 'deposit' | 'withdraw'
  amount: number
  currency: string
  method: string
  note: string | null
  transaction_time: string
  created_at: string
  updated_at: string
}

export type OrderRow = {
  id: string
  user_id: string
  balance_account_id: string
  ticket?: string | null
  symbol: string
  side: 'buy' | 'sell'
  entry_price: number
  sl_price?: number | null
  tp_price?: number | null
  volume: number
  leverage?: number | null
  original_position_size?: number | null
  commission_usd?: number | null
  swap_usd?: number | null
  equity_usd?: number | null
  margin_level?: number | null
  close_reason?: string | null
  status: 'open' | 'closed' | 'cancelled'
  open_time: string
  close_time?: string | null
  close_price?: number | null
  pnl_amount?: number | null
  pnl_percent?: number | null
  note?: string | null
  is_imported?: boolean
  created_at: string
  updated_at: string
}

export type ImportOrderRow = {
  ticket?: string | null
  symbol: string
  side: 'buy' | 'sell'
  entry_price: number
  sl_price?: number | null
  tp_price?: number | null
  volume: number
  leverage?: number | null
  original_position_size?: number | null
  commission_usd?: number | null
  swap_usd?: number | null
  equity_usd?: number | null
  margin_level?: number | null
  close_reason?: string | null
  status: 'open' | 'closed' | 'cancelled'
  open_time: string
  close_time?: string | null
  close_price?: number | null
  pnl_amount?: number | null
  pnl_percent?: number | null
  note?: string | null
  balance_account_id: string
}

export type ImportOrdersResponse = {
  success: boolean
  count: number
  skipped: number
  message?: string
}

export type LedgerRow = {
  id: string
  balance_account_id: string
  source_type: string
  source_ref_id: string | null
  amount: number
  balance_after: number
  occurred_at: string
  created_at: string
  currency: string
  meta: Record<string, unknown> | null
  balance_accounts?: {
    name?: string | null
    account_type?: 'TRADING' | 'FUNDING' | null
    currency?: string | null
  } | null
}

// Trading Dashboard Data
export async function getTradingDashboardData() {
  const response = await apiClient.get('/trading/dashboard')
  return response.data
}

export async function getLatestBalances() {
  const response = await apiClient.get('/trading/balances')
  return response.data as LatestBalanceRow[]
}

export async function getBalanceSnapshots(accountIds: string[], startDate: string) {
  const response = await apiClient.post('/trading/snapshots', { accountIds, startDate })
  return response.data as SnapshotRow[]
}

// Balance Accounts
export async function getBalanceAccounts() {
  const response = await apiClient.get('/trading/balance-accounts')
  return response.data as BalanceAccount[]
}

export async function createBalanceAccount(values: Partial<BalanceAccount>) {
  const response = await apiClient.post('/trading/balance-accounts', values)
  return response.data
}

export async function updateBalanceAccount(id: string, values: Partial<BalanceAccount>) {
  const response = await apiClient.put('/trading/balance-accounts', { id, ...values })
  return response.data
}

export async function deleteBalanceAccount(id: string) {
  const response = await apiClient.delete('/trading/balance-accounts', { data: { id } })
  return response.data
}

// Funding
export async function getFundingHistory() {
  const response = await apiClient.get('/trading/funding')
  return response.data as FundingRow[]
}

export async function createFunding(values: Partial<FundingRow>) {
  const response = await apiClient.post('/trading/funding', values)
  return response.data
}

export async function updateFunding(id: string, values: Partial<FundingRow>) {
  const response = await apiClient.put('/trading/funding', { id, ...values })
  return response.data
}

export async function deleteFunding(id: string) {
  const response = await apiClient.delete('/trading/funding', { data: { id } })
  return response.data
}

// Orders
export async function getOrders() {
  const response = await apiClient.get('/trading/orders')
  return response.data as OrderRow[]
}

export async function createOrder(values: Partial<OrderRow>) {
  const response = await apiClient.post('/trading/orders', values)
  return response.data
}

export async function updateOrder(id: string, values: Partial<OrderRow>) {
  const response = await apiClient.put('/trading/orders', { id, ...values })
  return response.data
}

export async function deleteOrder(id: string) {
  const response = await apiClient.delete('/trading/orders', { data: { id } })
  return response.data
}

export async function syncOrdersLedger() {
  const response = await apiClient.post('/trading/orders/sync-ledger')
  return response.data
}

export async function importOrders(rows: ImportOrderRow[]) {
  const response = await apiClient.post<ImportOrdersResponse>('/trading/orders/import', { rows })
  return response.data
}

// Ledger
export async function getLedger(limit = 200) {
  const response = await apiClient.get(`/trading/ledger?limit=${limit}`)
  return response.data as LedgerRow[]
}
