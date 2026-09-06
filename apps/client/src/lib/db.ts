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

class AppDB extends Dexie {
  pending!: Table<PendingOp, number>
  transactions!: Table<LocalTransaction, string>

  constructor() {
    super('xper_client_db')
    this.version(1).stores({
      pending: '++id,resource,opType,createdAt,tries',
      transactions: 'id,createdAt,updatedAt,pending',
    })
  }
}

export const db = new AppDB()

export default db
