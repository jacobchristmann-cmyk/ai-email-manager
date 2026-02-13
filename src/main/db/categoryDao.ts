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
