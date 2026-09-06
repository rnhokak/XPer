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
}

export type LocalCategory = {
  id: string
  name: string
  type: string
  parent_id: string | null
  level: number
  category_focus: string | null
  is_default: boolean | null
  user_id: string
}

class AppDB extends Dexie {
  pending!: Table<PendingOp, number>
  transactions!: Table<LocalTransaction, string>
  categories!: Table<LocalCategory, string>

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
  }
}

export const db = new AppDB()

export default db
