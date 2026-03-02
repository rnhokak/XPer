import { useQuery } from '@tanstack/react-query'
import { type CategoryFocus } from '@/lib/validation/categories'
import { getAccounts, getCategories } from '@/lib/api/cashflow'
import { getDebts, getDebtDetail, getDebtPartners } from '@/lib/api/debts'

export type Partner = { id: string; name: string; type: string | null; phone?: string | null; note?: string | null }
export type Account = { id: string; name: string; currency: string; type?: string | null; is_default?: boolean | null }
export type Category = {
  id: string
  name: string
  type: 'income' | 'expense' | 'transfer'
  parent_id?: string | null
  level?: 0 | 1 | 2
  category_focus: CategoryFocus | null
  is_default?: boolean | null
}
export type DebtPayment = { debt_id: string; payment_type: string; principal_amount: number | null; amount: number | null }

export type DebtRow = {
  id: string
  partner_id: string
  direction: 'lend' | 'borrow'
  principal_amount: number
  currency: string
  start_date: string
  due_date: string | null
  status: 'ongoing' | 'paid_off' | 'overdue' | 'cancelled'
  description: string | null
  interest_type: 'none' | 'fixed' | 'percent'
  interest_rate: number | null
  interest_cycle: 'day' | 'month' | 'year' | null
  created_at: string | null
  updated_at: string | null
  partner: Partner | null
  outstanding_principal: number
}

type PaymentRow = {
  id: string
  payment_type: 'disbursement' | 'repayment' | 'receive'
  amount: number
  principal_amount: number | null
  interest_amount: number | null
  payment_date: string
  note: string | null
  transaction: {
    id: string
    type: 'income' | 'expense' | 'transfer'
    amount: number
    currency: string
    transaction_time: string
    note: string | null
    account: { id: string; name: string | null; currency: string | null } | null
    category: { id: string; name: string | null; type: 'income' | 'expense' | 'transfer' | null } | null
  } | null
}

export const debtsOverviewQueryKey = (userId: string) => ['debts', 'overview', userId]
export const debtsFormQueryKey = (userId: string) => ['debts', 'form', userId]
export const debtDetailQueryKey = (debtId: string, userId: string) => ['debts', 'detail', debtId, userId]
export const debtPartnersQueryKey = (userId: string) => ['debts', 'partners', userId]

const computeOutstanding = (
  direction: 'lend' | 'borrow',
  principalAmount: number,
  payments: Array<{ payment_type: string; principal_amount: number | null; amount: number | null }>
) => {
  const paidPrincipal = payments.reduce((sum, p) => {
    const principal = p.principal_amount ?? p.amount ?? 0
    if (direction === 'borrow' && p.payment_type === 'repayment') {
      return sum + Number(principal)
    }
    if (direction === 'lend' && p.payment_type === 'receive') {
      return sum + Number(principal)
    }
    return sum
  }, 0)

  const remaining = Number(principalAmount) - paidPrincipal
  return remaining < 0 ? 0 : remaining
}

export function useDebtsOverviewData(userId: string) {
  return useQuery({
    queryKey: debtsOverviewQueryKey(userId),
    queryFn: async () => {
      const [partners, accounts, categories, debts] = await Promise.all([
        getDebtPartners(),
        getAccounts(),
        getCategories(),
        getDebts(),
      ])

      return {
        partners,
        accounts,
        categories,
        debts,
      }
    },
    enabled: Boolean(userId),
  })
}

export function useDebtsFormData(userId: string) {
  return useQuery({
    queryKey: debtsFormQueryKey(userId),
    queryFn: async () => {
      const [partners, accounts, categories] = await Promise.all([
        getDebtPartners(),
        getAccounts(),
        getCategories(),
      ])

      return { partners, accounts, categories }
    },
    enabled: Boolean(userId),
  })
}

export function useDebtPartners(userId: string) {
  return useQuery({
    queryKey: debtPartnersQueryKey(userId),
    queryFn: getDebtPartners,
    enabled: Boolean(userId),
  })
}

export function useDebtDetailData(userId: string, debtId: string | undefined) {
  return useQuery({
    queryKey: debtDetailQueryKey(debtId ?? '', userId),
    queryFn: async () => {
      if (!debtId) return null

      const data = await getDebtDetail(debtId)
      return {
        debt: data.debt,
        payments: data.payments,
        accounts: data.accounts,
        categories: data.categories,
      }
    },
    enabled: Boolean(userId && debtId),
  })
}

export const computeOutstandingPrincipal = computeOutstanding
export type DebtDetailPaymentRow = PaymentRow
