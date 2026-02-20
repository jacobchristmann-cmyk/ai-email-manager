import { v4 as uuid } from 'uuid'
import { getDb } from './database'
import type { ReplyTemplate } from '../../shared/types'

interface TemplateRow {
  id: string
  name: string
  body: string
  created_at: string
}

function rowToTemplate(row: TemplateRow): ReplyTemplate {
  return { id: row.id, name: row.name, body: row.body, createdAt: row.created_at }
}

export function listTemplates(): ReplyTemplate[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM reply_templates ORDER BY created_at ASC').all() as TemplateRow[]
  return rows.map(rowToTemplate)
}

export function createTemplate(name: string, body: string): ReplyTemplate {
  const db = getDb()
  const id = `tpl-${uuid().slice(0, 8)}`
  db.prepare('INSERT INTO reply_templates (id, name, body) VALUES (?, ?, ?)').run(id, name, body)
  return rowToTemplate(db.prepare('SELECT * FROM reply_templates WHERE id = ?').get(id) as TemplateRow)
}

export function updateTemplate(id: string, data: { name?: string; body?: string }): ReplyTemplate | undefined {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.body !== undefined) { fields.push('body = ?'); values.push(data.body) }
  if (fields.length === 0) return undefined
  values.push(id)
  db.prepare(`UPDATE reply_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  const row = db.prepare('SELECT * FROM reply_templates WHERE id = ?').get(id) as TemplateRow | undefined
  return row ? rowToTemplate(row) : undefined
}

export function deleteTemplate(id: string): void {
  getDb().prepare('DELETE FROM reply_templates WHERE id = ?').run(id)
}
