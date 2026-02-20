import { v4 as uuid } from 'uuid'
import { getDb } from './database'
import type { FollowUp } from '../../shared/types'

interface FollowUpRow {
  id: string
  email_id: string
  account_id: string
  message_id: string
  subject: string
  remind_at: string
  status: string
  created_at: string
}

function rowToFollowUp(row: FollowUpRow): FollowUp {
  return {
    id: row.id,
    emailId: row.email_id,
    accountId: row.account_id,
    messageId: row.message_id,
    subject: row.subject,
    remindAt: row.remind_at,
    status: row.status as FollowUp['status'],
    createdAt: row.created_at
  }
}

export function setFollowUp(
  emailId: string,
  accountId: string,
  messageId: string,
  subject: string,
  remindAt: string
): FollowUp {
  const db = getDb()
  // Remove any existing pending follow-up for this email
  db.prepare(`DELETE FROM follow_ups WHERE email_id = ? AND status = 'pending'`).run(emailId)
  const id = uuid()
  db.prepare(
    `INSERT INTO follow_ups (id, email_id, account_id, message_id, subject, remind_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  ).run(id, emailId, accountId, messageId, subject, remindAt)
  return rowToFollowUp(
    db.prepare(`SELECT * FROM follow_ups WHERE id = ?`).get(id) as FollowUpRow
  )
}

export function dismissFollowUp(id: string): void {
  getDb().prepare(`UPDATE follow_ups SET status = 'dismissed' WHERE id = ?`).run(id)
}

export function listPendingFollowUps(): FollowUp[] {
  const rows = getDb()
    .prepare(`SELECT * FROM follow_ups WHERE status = 'pending' ORDER BY remind_at ASC`)
    .all() as FollowUpRow[]
  return rows.map(rowToFollowUp)
}

/** Returns follow-ups whose remind_at has passed and that have no reply yet. */
export function getDueFollowUps(): FollowUp[] {
  const rows = getDb()
    .prepare(
      `SELECT f.* FROM follow_ups f
       WHERE f.status = 'pending'
         AND f.remind_at <= datetime('now')
         AND NOT EXISTS (
           SELECT 1 FROM emails e
           WHERE e.account_id = f.account_id
             AND e.in_reply_to = f.message_id
         )`
    )
    .all() as FollowUpRow[]
  return rows.map(rowToFollowUp)
}

/** Mark follow-ups as fired (notification was shown). */
export function markFollowUpsFired(ids: string[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(', ')
  getDb()
    .prepare(`UPDATE follow_ups SET status = 'fired' WHERE id IN (${placeholders})`)
    .run(...ids)
}

/** Auto-dismiss follow-ups that received a reply in the meantime. */
export function autoDismissReplied(): void {
  getDb().exec(`
    UPDATE follow_ups SET status = 'dismissed'
    WHERE status = 'pending'
      AND EXISTS (
        SELECT 1 FROM emails e
        WHERE e.account_id = follow_ups.account_id
          AND e.in_reply_to = follow_ups.message_id
      )
  `)
}
