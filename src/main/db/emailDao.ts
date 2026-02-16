import { v4 as uuid } from 'uuid'
import { getDb } from './database'
import type { Email } from '../../shared/types'

interface EmailRow {
  id: string
  account_id: string
  message_id: string
  uid: number
  subject: string
  from_address: string
  to_address: string
  date: string
  body: string
  body_html: string | null
  is_read: number
  category_id: string | null
  created_at: string
}

function rowToEmail(row: EmailRow): Email {
  return {
    id: row.id,
    accountId: row.account_id,
    messageId: row.message_id,
    uid: row.uid,
    subject: row.subject,
    from: row.from_address,
    to: row.to_address,
    date: row.date,
    body: row.body,
    bodyHtml: row.body_html ?? null,
    isRead: row.is_read === 1,
    categoryId: row.category_id
  }
}

export interface EmailInsert {
  accountId: string
  messageId: string
  uid: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  bodyHtml?: string | null
}

export function insertEmail(data: EmailInsert): Email | null {
  const db = getDb()
  const id = uuid()
  try {
    db.prepare(
      `INSERT OR IGNORE INTO emails (id, account_id, message_id, uid, subject, from_address, to_address, date, body, body_html)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.accountId, data.messageId, data.uid, data.subject, data.from, data.to, data.date, data.body, data.bodyHtml ?? null)
    const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined
    return row ? rowToEmail(row) : null
  } catch {
    return null
  }
}

export function insertEmails(emails: EmailInsert[]): number {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO emails (id, account_id, message_id, uid, subject, from_address, to_address, date, body, body_html)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  let inserted = 0
  const transaction = db.transaction(() => {
    for (const e of emails) {
      const result = stmt.run(uuid(), e.accountId, e.messageId, e.uid, e.subject, e.from, e.to, e.date, e.body, e.bodyHtml ?? null)
      if (result.changes > 0) inserted++
    }
  })
  transaction()
  return inserted
}

export function listEmails(accountId?: string): Email[] {
  const db = getDb()
  if (accountId) {
    const rows = db.prepare('SELECT * FROM emails WHERE account_id = ? ORDER BY date DESC').all(accountId) as EmailRow[]
    return rows.map(rowToEmail)
  }
  const rows = db.prepare('SELECT * FROM emails ORDER BY date DESC').all() as EmailRow[]
  return rows.map(rowToEmail)
}

export function getEmail(id: string): Email | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined
  return row ? rowToEmail(row) : undefined
}

export function markRead(id: string): void {
  const db = getDb()
  db.prepare('UPDATE emails SET is_read = 1 WHERE id = ?').run(id)
}

export function deleteEmail(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM emails WHERE id = ?').run(id)
}

export function getUnreadCount(accountId?: string): number {
  const db = getDb()
  if (accountId) {
    const row = db.prepare('SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND is_read = 0').get(accountId) as { count: number }
    return row.count
  }
  const row = db.prepare('SELECT COUNT(*) as count FROM emails WHERE is_read = 0').get() as { count: number }
  return row.count
}
