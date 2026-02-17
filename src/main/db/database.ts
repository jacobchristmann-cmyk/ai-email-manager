import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'email-manager.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'imap',
      imap_host TEXT NOT NULL,
      imap_port INTEGER NOT NULL,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_sync_at TEXT,
      last_uid INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      uid INTEGER NOT NULL DEFAULT 0,
      subject TEXT NOT NULL DEFAULT '',
      from_address TEXT NOT NULL DEFAULT '',
      to_address TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      category_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(account_id, message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_emails_account_date ON emails(account_id, date DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6B7280',
      description TEXT NOT NULL DEFAULT ''
    );

    INSERT OR IGNORE INTO categories (id, name, color, description) VALUES
      ('cat-wichtig', 'Wichtig', '#EF4444', 'Wichtige E-Mails'),
      ('cat-newsletter', 'Newsletter', '#8B5CF6', 'Newsletter und Abonnements'),
      ('cat-social', 'Social', '#3B82F6', 'Soziale Netzwerke und Benachrichtigungen'),
      ('cat-arbeit', 'Arbeit', '#F59E0B', 'Berufliche E-Mails'),
      ('cat-persoenlich', 'Persönlich', '#10B981', 'Persönliche E-Mails'),
      ('cat-spam', 'Spam', '#6B7280', 'Unerwünschte E-Mails');
  `)

  // Migrations
  const columns = db.pragma('table_info(emails)') as { name: string }[]
  if (!columns.some((c) => c.name === 'body_html')) {
    db.exec('ALTER TABLE emails ADD COLUMN body_html TEXT')
  }
  if (!columns.some((c) => c.name === 'mailbox')) {
    db.exec("ALTER TABLE emails ADD COLUMN mailbox TEXT DEFAULT 'INBOX'")
  }

  // Mailbox sync state table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mailbox_sync_state (
      account_id TEXT NOT NULL,
      mailbox TEXT NOT NULL,
      last_uid INTEGER DEFAULT 0,
      PRIMARY KEY (account_id, mailbox),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `)

  // Training data: manual category corrections the AI should learn from
  db.exec(`
    CREATE TABLE IF NOT EXISTS category_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_subject TEXT NOT NULL DEFAULT '',
      email_from TEXT NOT NULL DEFAULT '',
      email_snippet TEXT NOT NULL DEFAULT '',
      category_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Migrate existing last_uid from accounts to mailbox_sync_state for INBOX
  db.exec(`
    INSERT OR IGNORE INTO mailbox_sync_state (account_id, mailbox, last_uid)
    SELECT id, 'INBOX', last_uid FROM accounts WHERE last_uid > 0
  `)

  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
