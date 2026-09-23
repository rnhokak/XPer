import Dexie, { Table } from 'dexie'

export type PendingOp = {
  id?: number
  opType: 'create' | 'update' | 'delete'
  resource: string
  body: any
  createdAt: number
  tries: number
}

export type LocalTransaction = {
  id: string
  payload?: any
  createdAt?: number
  updatedAt?: number
  pending?: boolean
  error?: boolean
  [key: string]: any
}

export type LocalCategory = {
  id: string
  name: string
  type: string
  parent_id: string | null
  level: number
  category_focus: string | null
  is_default: boolean | null
  user_id?: string
  [key: string]: any
}

export type LocalAccount = {
  id: string
  name: string
  currency: string
  type?: string | null
  is_default?: boolean | null
  balance?: number
  user_id?: string
  [key: string]: any
}

export type LocalDebt = {
  id: string
  partner_id: string
  direction: 'lend' | 'borrow'
  principal_amount: number
  currency: string
  start_date: string
  due_date: string | null
  status: 'ongoing' | 'paid_off' | 'overdue' | 'cancelled'
  description?: string | null
  interest_type?: 'none' | 'fixed' | 'percent'
  interest_rate?: number | null
  interest_cycle?: 'day' | 'month' | 'year' | null
  created_at?: string | null
  updated_at?: string | null
  partner?: any
  outstanding_principal?: number
  [key: string]: any
}

export type LocalDebtPartner = {
  id: string
  name: string
  type?: string | null
  phone?: string | null
  note?: string | null
  category_id?: string | null
  [key: string]: any
}

class AppDB extends Dexie {
  pending!: Table<PendingOp, number>
  transactions!: Table<LocalTransaction, string>
  categories!: Table<LocalCategory, string>
  accounts!: Table<LocalAccount, string>
  debts!: Table<LocalDebt, string>
  debtPartners!: Table<LocalDebtPartner, string>

  constructor() {
    super('xper_client_db')
    this.version(1).stores({
      pending: '++id,resource,opType,createdAt,tries',
      transactions: 'id,createdAt,updatedAt,pending',
    })
    this.version(2).stores({
      pending: '++id,resource,opType,createdAt,tries',
      transactions: 'id,createdAt,updatedAt,pending',
      categories: 'id,name,type,parent_id,level',
    })
    this.version(3).stores({
      pending: '++id,resource,opType,createdAt,tries',
      transactions: 'id,createdAt,updatedAt,pending',
      categories: 'id,name,type,parent_id,level',
      accounts: 'id,name,currency,type,is_default',
      debts: 'id,partner_id,direction,status',
      debtPartners: 'id,name',
    })
  }
}

export const db = new AppDB()

export default db
