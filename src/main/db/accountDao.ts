import { v4 as uuid } from 'uuid'
import { getDb } from './database'
import type { Account, AccountCreate } from '../../shared/types'

interface AccountRow {
  id: string
  name: string
  email: string
  provider: string
  imap_host: string
  imap_port: number
  smtp_host: string
  smtp_port: number
  username: string
  password: string
  created_at: string
  last_sync_at: string | null
  last_uid: number
}

function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    provider: row.provider as Account['provider'],
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    username: row.username,
    password: row.password,
    createdAt: row.created_at,
    lastSyncAt: row.last_sync_at
  }
}

export function createAccount(data: AccountCreate): Account {
  const db = getDb()
  const id = uuid()
  db.prepare(
    `INSERT INTO accounts (id, name, email, provider, imap_host, imap_port, smtp_host, smtp_port, username, password)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.name, data.email, data.provider, data.imapHost, data.imapPort, data.smtpHost, data.smtpPort, data.username, data.password)

  return getAccount(id)!
}

export function listAccounts(): Account[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all() as AccountRow[]
  return rows.map(rowToAccount)
}

export function getAccount(id: string): Account | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined
  return row ? rowToAccount(row) : undefined
}

export function updateAccount(id: string, data: Partial<AccountCreate>): Account | undefined {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email) }
  if (data.provider !== undefined) { fields.push('provider = ?'); values.push(data.provider) }
  if (data.imapHost !== undefined) { fields.push('imap_host = ?'); values.push(data.imapHost) }
  if (data.imapPort !== undefined) { fields.push('imap_port = ?'); values.push(data.imapPort) }
  if (data.smtpHost !== undefined) { fields.push('smtp_host = ?'); values.push(data.smtpHost) }
  if (data.smtpPort !== undefined) { fields.push('smtp_port = ?'); values.push(data.smtpPort) }
  if (data.username !== undefined) { fields.push('username = ?'); values.push(data.username) }
  if (data.password !== undefined) { fields.push('password = ?'); values.push(data.password) }

  if (fields.length === 0) return getAccount(id)

  values.push(id)
  db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return getAccount(id)
}

export function deleteAccount(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
}

export function updateLastSync(id: string, lastUid: number): void {
  const db = getDb()
  db.prepare("UPDATE accounts SET last_sync_at = datetime('now'), last_uid = ? WHERE id = ?").run(lastUid, id)
}

export function getLastUid(id: string): number {
  const db = getDb()
  const row = db.prepare('SELECT last_uid FROM accounts WHERE id = ?').get(id) as { last_uid: number } | undefined
  return row?.last_uid ?? 0
}
