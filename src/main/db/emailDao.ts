import { v4 as uuid } from 'uuid'
import { getDb } from './database'
import type { Email, UnsubscribeLog } from '../../shared/types'

interface EmailRow {
  id: string
  account_id: string
  message_id: string
  uid: number
  mailbox: string
  subject: string
  from_address: string
  to_address: string
  date: string
  body: string
  body_html: string | null
  list_unsubscribe: string | null
  list_unsubscribe_post: string | null
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
    mailbox: row.mailbox || 'INBOX',
    subject: row.subject,
    from: row.from_address,
    to: row.to_address,
    date: row.date,
    body: row.body,
    bodyHtml: row.body_html ?? null,
    listUnsubscribe: row.list_unsubscribe ?? null,
    listUnsubscribePost: row.list_unsubscribe_post ?? null,
    isRead: row.is_read === 1,
    categoryId: row.category_id
  }
}

export interface EmailInsert {
  accountId: string
  messageId: string
  uid: number
  mailbox: string
  subject: string
  from: string
  to: string
  date: string
  body: string
  bodyHtml?: string | null
  listUnsubscribe?: string | null
  listUnsubscribePost?: string | null
  isRead?: boolean
}

export function insertEmail(data: EmailInsert): Email | null {
  const db = getDb()
  const id = uuid()
  try {
    db.prepare(
      `INSERT OR IGNORE INTO emails (id, account_id, message_id, uid, mailbox, subject, from_address, to_address, date, body, body_html, list_unsubscribe, list_unsubscribe_post, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.accountId, data.messageId, data.uid, data.mailbox, data.subject, data.from, data.to, data.date, data.body, data.bodyHtml ?? null, data.listUnsubscribe ?? null, data.listUnsubscribePost ?? null, data.isRead ? 1 : 0)
    const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined
    return row ? rowToEmail(row) : null
  } catch {
    return null
  }
}

export function insertEmails(emails: EmailInsert[]): number {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO emails (id, account_id, message_id, uid, mailbox, subject, from_address, to_address, date, body, body_html, list_unsubscribe, list_unsubscribe_post, is_read)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  let inserted = 0
  const transaction = db.transaction(() => {
    for (const e of emails) {
      const result = stmt.run(uuid(), e.accountId, e.messageId, e.uid, e.mailbox, e.subject, e.from, e.to, e.date, e.body, e.bodyHtml ?? null, e.listUnsubscribe ?? null, e.listUnsubscribePost ?? null, e.isRead ? 1 : 0)
      if (result.changes > 0) inserted++
    }
  })
  transaction()
  return inserted
}

export function listEmails(accountId?: string, mailbox?: string): Email[] {
  const db = getDb()
  const limit = 500
  if (accountId && mailbox) {
    const rows = db.prepare('SELECT * FROM emails WHERE account_id = ? AND mailbox = ? ORDER BY date DESC LIMIT ?').all(accountId, mailbox, limit) as EmailRow[]
    return rows.map(rowToEmail)
  }
  if (accountId) {
    const rows = db.prepare('SELECT * FROM emails WHERE account_id = ? ORDER BY date DESC LIMIT ?').all(accountId, limit) as EmailRow[]
    return rows.map(rowToEmail)
  }
  const rows = db.prepare('SELECT * FROM emails ORDER BY date DESC LIMIT ?').all(limit) as EmailRow[]
  return rows.map(rowToEmail)
}

const EXCLUDED_MAILBOXES_PATTERN = /junk|spam|unerwünscht|unerwuenscht|trash|papierkorb/i

export function listEmailsForAI(accountId?: string, mailbox?: string): Email[] {
  return listEmails(accountId, mailbox).filter(
    (e) => !EXCLUDED_MAILBOXES_PATTERN.test(e.mailbox)
  )
}

export function getEmail(id: string): Email | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined
  return row ? rowToEmail(row) : undefined
}

export function updateEmailBody(id: string, body: string, bodyHtml: string | null, listUnsubscribe: string | null, listUnsubscribePost: string | null): void {
  const db = getDb()
  db.prepare('UPDATE emails SET body = ?, body_html = ?, list_unsubscribe = ?, list_unsubscribe_post = ? WHERE id = ?')
    .run(body, bodyHtml, listUnsubscribe, listUnsubscribePost, id)
}

export function markRead(id: string): void {
  const db = getDb()
  db.prepare('UPDATE emails SET is_read = 1 WHERE id = ?').run(id)
}

export function markUnread(id: string): void {
  const db = getDb()
  db.prepare('UPDATE emails SET is_read = 0 WHERE id = ?').run(id)
}

export function deleteEmail(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM emails WHERE id = ?').run(id)
}

export function getUnreadUidsForMailbox(accountId: string, mailbox: string): { id: string; uid: number }[] {
  const db = getDb()
  return db.prepare(
    'SELECT id, uid FROM emails WHERE account_id = ? AND mailbox = ? AND is_read = 0 AND uid > 0'
  ).all(accountId, mailbox) as { id: string; uid: number }[]
}

export function markReadByIds(ids: string[]): void {
  if (ids.length === 0) return
  const db = getDb()
  const stmt = db.prepare('UPDATE emails SET is_read = 1 WHERE id = ?')
  const transaction = db.transaction(() => {
    for (const id of ids) {
      stmt.run(id)
    }
  })
  transaction()
}

export function getUnreadCounts(accountId: string): Record<string, number> {
  const db = getDb()
  const rows = db.prepare(
    'SELECT mailbox, COUNT(*) as count FROM emails WHERE account_id = ? AND is_read = 0 GROUP BY mailbox'
  ).all(accountId) as { mailbox: string; count: number }[]
  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.mailbox] = row.count
  }
  return result
}

// === Search ===

export interface EmailSearchParams {
  query?: string
  from?: string
  to?: string
  subject?: string
  dateFrom?: string
  dateTo?: string
  isRead?: boolean
  categoryId?: string
  accountId?: string
  mailbox?: string
  limit?: number
}

export function searchEmails(params: EmailSearchParams): Email[] {
  const db = getDb()
  const conditions: string[] = []
  const values: unknown[] = []

  if (params.accountId) {
    conditions.push('account_id = ?')
    values.push(params.accountId)
  }
  if (params.mailbox) {
    conditions.push('mailbox = ?')
    values.push(params.mailbox)
  }
  if (params.from) {
    conditions.push('from_address LIKE ?')
    values.push(`%${params.from}%`)
  }
  if (params.to) {
    conditions.push('to_address LIKE ?')
    values.push(`%${params.to}%`)
  }
  if (params.subject) {
    conditions.push('subject LIKE ?')
    values.push(`%${params.subject}%`)
  }
  if (params.categoryId) {
    conditions.push('category_id = ?')
    values.push(params.categoryId)
  }
  if (params.query) {
    conditions.push('(subject LIKE ? OR from_address LIKE ? OR body LIKE ?)')
    const q = `%${params.query}%`
    values.push(q, q, q)
  }
  if (params.dateFrom) {
    conditions.push('date >= ?')
    values.push(params.dateFrom)
  }
  if (params.dateTo) {
    conditions.push('date <= ?')
    values.push(params.dateTo + 'T23:59:59.999Z')
  }
  if (params.isRead !== undefined) {
    conditions.push('is_read = ?')
    values.push(params.isRead ? 1 : 0)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = params.limit ?? 100
  const sql = `SELECT * FROM emails ${where} ORDER BY date DESC LIMIT ?`
  values.push(limit)

  const rows = db.prepare(sql).all(...values) as EmailRow[]
  return rows.map(rowToEmail)
}

export function getUnreadCount(accountId?: string, mailbox?: string): number {
  const db = getDb()
  if (accountId && mailbox) {
    const row = db.prepare('SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND mailbox = ? AND is_read = 0').get(accountId, mailbox) as { count: number }
    return row.count
  }
  if (accountId) {
    const row = db.prepare('SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND is_read = 0').get(accountId) as { count: number }
    return row.count
  }
  const row = db.prepare('SELECT COUNT(*) as count FROM emails WHERE is_read = 0').get() as { count: number }
  return row.count
}

export function markAllReadInMailbox(accountId: string, mailbox: string): number {
  const db = getDb()
  const result = db.prepare('UPDATE emails SET is_read = 1 WHERE account_id = ? AND mailbox = ? AND is_read = 0').run(accountId, mailbox)
  return result.changes
}

// === Mailbox Update ===

export function updateEmailMailbox(id: string, mailbox: string): void {
  const db = getDb()
  db.prepare('UPDATE emails SET mailbox = ? WHERE id = ?').run(mailbox, id)
}

// === Unsubscribe Log ===

interface UnsubscribeLogRow {
  id: string
  email_id: string
  sender: string
  method: string
  status: string
  url: string | null
  created_at: string
  confirmed_at: string | null
}

function rowToUnsubscribeLog(row: UnsubscribeLogRow): UnsubscribeLog {
  return {
    id: row.id,
    emailId: row.email_id,
    sender: row.sender,
    method: row.method as 'post' | 'browser',
    status: row.status as 'confirmed' | 'pending' | 'failed',
    url: row.url ?? undefined,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at ?? undefined
  }
}

export function insertUnsubscribeLog(data: {
  emailId: string
  sender: string
  method: 'post' | 'browser'
  status: 'confirmed' | 'pending' | 'failed'
  url?: string
}): UnsubscribeLog {
  const db = getDb()
  const id = uuid()
  db.prepare(
    'INSERT INTO unsubscribe_log (id, email_id, sender, method, status, url) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, data.emailId, data.sender, data.method, data.status, data.url ?? null)
  const row = db.prepare('SELECT * FROM unsubscribe_log WHERE id = ?').get(id) as UnsubscribeLogRow
  return rowToUnsubscribeLog(row)
}

export function updateUnsubscribeStatus(id: string, status: 'confirmed' | 'pending' | 'failed'): void {
  const db = getDb()
  const confirmedAt = status === 'confirmed' ? new Date().toISOString() : null
  db.prepare('UPDATE unsubscribe_log SET status = ?, confirmed_at = ? WHERE id = ?').run(status, confirmedAt, id)
}

export function listUnsubscribeLogs(): UnsubscribeLog[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM unsubscribe_log ORDER BY created_at DESC').all() as UnsubscribeLogRow[]
  return rows.map(rowToUnsubscribeLog)
}

export function getUnsubscribeLogByEmailId(emailId: string): UnsubscribeLog | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM unsubscribe_log WHERE email_id = ?').get(emailId) as UnsubscribeLogRow | undefined
  return row ? rowToUnsubscribeLog(row) : undefined
}
