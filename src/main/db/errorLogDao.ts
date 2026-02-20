import { getDb } from './database'

export interface ErrorLogRow {
  id: number
  level: string
  context: string
  message: string
  stack: string | null
  created_at: string
}

export function insertLog(level: string, context: string, message: string, stack?: string): void {
  const db = getDb()
  db.prepare(
    'INSERT INTO error_logs (level, context, message, stack) VALUES (?, ?, ?, ?)'
  ).run(level, context, message.slice(0, 2000), stack?.slice(0, 4000) ?? null)
}

export function listLogs(limit = 200): ErrorLogRow[] {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM error_logs ORDER BY id DESC LIMIT ?'
  ).all(limit) as ErrorLogRow[]
}

export function clearLogs(): void {
  getDb().exec('DELETE FROM error_logs')
}
