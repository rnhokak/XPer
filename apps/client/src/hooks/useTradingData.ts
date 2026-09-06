import { useQuery, useMutation, useQueryClient } from '@/lib/query'
import {
  getLatestBalances,
  getBalanceSnapshots,
  getBalanceAccounts,
  createBalanceAccount,
  updateBalanceAccount,
  deleteBalanceAccount,
  getFundingHistory,
  createFunding,
  updateFunding,
  deleteFunding,
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  syncOrdersLedger,
  getLedger,
  type BalanceAccount,
  type FundingRow,
  type OrderRow,
} from '@/lib/api/trading'

const tradingDashboardQueryKey = ['trading', 'dashboard']
const tradingBalancesQueryKey = ['trading', 'balances']
const tradingSnapshotsQueryKey = (accountIds: string[]) => ['trading', 'snapshots', accountIds]

export function useTradingDashboardData() {
  return useQuery({ queryKey: tradingDashboardQueryKey, queryFn: async () => ({ balances: await getLatestBalances() }) })
}

export function useLatestBalances() {
  return useQuery({ queryKey: tradingBalancesQueryKey, queryFn: getLatestBalances })
}

export function useBalanceSnapshots(accountIds: string[], startDate: string) {
  return useQuery({ queryKey: tradingSnapshotsQueryKey(accountIds), queryFn: () => getBalanceSnapshots(accountIds, startDate), enabled: accountIds.length > 0 })
}

const balanceAccountsQueryKey = ['trading', 'balance-accounts']

export function useBalanceAccounts() {
  return useQuery({ queryKey: balanceAccountsQueryKey, queryFn: getBalanceAccounts })
}

export function useCreateBalanceAccount() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (values: Partial<BalanceAccount>) => createBalanceAccount(values), onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: balanceAccountsQueryKey })
    queryClient.invalidateQueries({ queryKey: tradingBalancesQueryKey })
  } })
}

export function useUpdateBalanceAccount() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: ({ id, values }: { id: string; values: Partial<BalanceAccount> }) => updateBalanceAccount(id, values), onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: balanceAccountsQueryKey })
    queryClient.invalidateQueries({ queryKey: tradingBalancesQueryKey })
  } })
}

export function useDeleteBalanceAccount() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: deleteBalanceAccount, onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: balanceAccountsQueryKey })
    queryClient.invalidateQueries({ queryKey: tradingBalancesQueryKey })
  } })
}

const fundingQueryKey = ['trading', 'funding']

export function useFundingHistory() {
  return useQuery({ queryKey: fundingQueryKey, queryFn: getFundingHistory })
}

export function useCreateFunding() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (values: Partial<FundingRow>) => createFunding(values), onSuccess: () => queryClient.invalidateQueries({ queryKey: fundingQueryKey }) })
}

export function useUpdateFunding() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: ({ id, values }: { id: string; values: Partial<FundingRow> }) => updateFunding(id, values), onSuccess: () => queryClient.invalidateQueries({ queryKey: fundingQueryKey }) })
}

export function useDeleteFunding() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: deleteFunding, onSuccess: () => queryClient.invalidateQueries({ queryKey: fundingQueryKey }) })
}

const ordersQueryKey = ['trading', 'orders']

export function useOrders() {
  return useQuery({ queryKey: ordersQueryKey, queryFn: getOrders })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (values: Partial<OrderRow>) => createOrder(values), onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersQueryKey }) })
}

export function useUpdateOrder() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: ({ id, values }: { id: string; values: Partial<OrderRow> }) => updateOrder(id, values), onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersQueryKey }) })
}

export function useDeleteOrder() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: deleteOrder, onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersQueryKey }) })
}

export function useSyncOrdersLedger() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: syncOrdersLedger, onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ordersQueryKey })
    queryClient.invalidateQueries({ queryKey: ['trading', 'ledger'] })
  } })
}

const ledgerQueryKey = ['trading', 'ledger']

export function useLedger(limit = 200) {
  return useQuery({ queryKey: ledgerQueryKey, queryFn: () => getLedger(limit) })
}
