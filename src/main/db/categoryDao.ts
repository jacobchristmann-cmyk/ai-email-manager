import { v4 as uuid } from 'uuid'
import { getDb } from './database'
import type { Category, CategoryCreate } from '../../shared/types'

interface CategoryRow {
  id: string
  name: string
  color: string
  description: string
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description
  }
}

export function listCategories(): Category[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM categories ORDER BY name').all() as CategoryRow[]
  return rows.map(rowToCategory)
}

export function getCategory(id: string): Category | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow | undefined
  return row ? rowToCategory(row) : undefined
}

export function createCategory(data: CategoryCreate): Category {
  const db = getDb()
  const id = `cat-${uuid().slice(0, 8)}`
  db.prepare('INSERT INTO categories (id, name, color, description) VALUES (?, ?, ?, ?)').run(
    id,
    data.name,
    data.color,
    data.description
  )
  return getCategory(id)!
}

export function updateCategory(
  id: string,
  data: Partial<CategoryCreate>
): Category | undefined {
  const db = getDb()
  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.color !== undefined) {
    fields.push('color = ?')
    values.push(data.color)
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description)
  }

  if (fields.length === 0) return getCategory(id)

  values.push(id)
  db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return getCategory(id)
}

export function deleteCategory(id: string): void {
  const db = getDb()
  db.prepare('UPDATE emails SET category_id = NULL WHERE category_id = ?').run(id)
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
}

export function updateEmailCategory(emailId: string, categoryId: string | null): void {
  const db = getDb()
  db.prepare('UPDATE emails SET category_id = ? WHERE id = ?').run(categoryId, emailId)
}

export function updateEmailCategories(updates: Record<string, string>): void {
  const db = getDb()
  const stmt = db.prepare('UPDATE emails SET category_id = ? WHERE id = ?')
  const transaction = db.transaction(() => {
    for (const [emailId, categoryId] of Object.entries(updates)) {
      stmt.run(categoryId, emailId)
    }
  })
  transaction()
}

// ── Training / Corrections ──

export function addCategoryCorrection(
  emailSubject: string,
  emailFrom: string,
  emailSnippet: string,
  categoryId: string
): void {
  const db = getDb()
  // Avoid duplicate entries for the same email content
  db.prepare(
    `INSERT INTO category_corrections (email_subject, email_from, email_snippet, category_id)
     VALUES (?, ?, ?, ?)`
  ).run(emailSubject, emailFrom, emailSnippet.slice(0, 300), categoryId)

  // Keep max 200 corrections (oldest get deleted)
  db.prepare(
    `DELETE FROM category_corrections WHERE id NOT IN (
       SELECT id FROM category_corrections ORDER BY created_at DESC LIMIT 200
     )`
  ).run()
}

export function listCategoryCorrections(): {
  subject: string
  from: string
  snippet: string
  categoryId: string
}[] {
  const db = getDb()
  const rows = db
    .prepare(
      'SELECT email_subject, email_from, email_snippet, category_id FROM category_corrections ORDER BY created_at DESC LIMIT 50'
    )
    .all() as {
    email_subject: string
    email_from: string
    email_snippet: string
    category_id: string
  }[]
  return rows.map((r) => ({
    subject: r.email_subject,
    from: r.email_from,
    snippet: r.email_snippet,
    categoryId: r.category_id
  }))
}
