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
  if (!columns.some((c) => c.name === 'list_unsubscribe')) {
    db.exec('ALTER TABLE emails ADD COLUMN list_unsubscribe TEXT')
  }
  if (!columns.some((c) => c.name === 'list_unsubscribe_post')) {
    db.exec('ALTER TABLE emails ADD COLUMN list_unsubscribe_post TEXT')
  }
  if (!columns.some((c) => c.name === 'is_starred')) {
    db.exec('ALTER TABLE emails ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0')
  }
  if (!columns.some((c) => c.name === 'has_attachments')) {
    db.exec('ALTER TABLE emails ADD COLUMN has_attachments INTEGER NOT NULL DEFAULT 0')
  }
  if (!columns.some((c) => c.name === 'attachments')) {
    db.exec('ALTER TABLE emails ADD COLUMN attachments TEXT')
  }
  if (!columns.some((c) => c.name === 'in_reply_to')) {
    db.exec('ALTER TABLE emails ADD COLUMN in_reply_to TEXT')
  }
  if (!columns.some((c) => c.name === 'thread_id')) {
    db.exec('ALTER TABLE emails ADD COLUMN thread_id TEXT')
  }
  if (!columns.some((c) => c.name === 'snoozed_until')) {
    db.exec('ALTER TABLE emails ADD COLUMN snoozed_until TEXT')
  }
  if (!columns.some((c) => c.name === 'action_items')) {
    db.exec('ALTER TABLE emails ADD COLUMN action_items TEXT')
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

  // Reply templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS reply_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO reply_templates (id, name, body) VALUES
      ('tpl-abwesenheit', 'Abwesenheitsnotiz', 'Guten Tag,

vielen Dank für Ihre E-Mail. Ich bin derzeit nicht erreichbar und werde mich so schnell wie möglich bei Ihnen melden.

Mit freundlichen Grüßen
{{MeinName}}'),
      ('tpl-bestaetigung', 'Bestätigung', 'Guten Tag,

hiermit bestätige ich den Erhalt Ihrer E-Mail zum Thema "{{Betreff}}". Ich werde mich zeitnah darum kümmern.

Mit freundlichen Grüßen
{{MeinName}}'),
      ('tpl-rueckfrage', 'Rückfrage', 'Guten Tag,

bezugnehmend auf Ihre E-Mail hätte ich noch eine kurze Frage:

Mit freundlichen Grüßen
{{MeinName}}')
  `)

  // Unsubscribe tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS unsubscribe_log (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT
    )
  `)

  // Migrate existing last_uid from accounts to mailbox_sync_state for INBOX
  db.exec(`
    INSERT OR IGNORE INTO mailbox_sync_state (account_id, mailbox, last_uid)
    SELECT id, 'INBOX', last_uid FROM accounts WHERE last_uid > 0
  `)

  // Migration: change unique constraint to include mailbox
  // Check if we need to migrate by looking for the old unique index
  const indices = db.pragma('index_list(emails)') as { name: string; unique: number }[]
  const dbRef = db
  const hasOldUnique = indices.some((idx) => {
    if (!idx.unique) return false
    const cols = dbRef.pragma(`index_info(${idx.name})`) as { name: string }[]
    return cols.length === 2 && cols.some((c) => c.name === 'account_id') && cols.some((c) => c.name === 'message_id') && !cols.some((c) => c.name === 'mailbox')
  })
  if (hasOldUnique) {
    console.log('[db] Migrating unique constraint to include mailbox...')
    db.exec(`
      CREATE TABLE IF NOT EXISTS emails_new (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        uid INTEGER NOT NULL DEFAULT 0,
        mailbox TEXT DEFAULT 'INBOX',
        subject TEXT NOT NULL DEFAULT '',
        from_address TEXT NOT NULL DEFAULT '',
        to_address TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        body_html TEXT,
        list_unsubscribe TEXT,
        list_unsubscribe_post TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        category_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, message_id, mailbox)
      );
      INSERT OR IGNORE INTO emails_new SELECT id, account_id, message_id, uid, mailbox, subject, from_address, to_address, date, body, body_html, list_unsubscribe, list_unsubscribe_post, is_read, category_id, created_at FROM emails;
      DROP TABLE emails;
      ALTER TABLE emails_new RENAME TO emails;
      CREATE INDEX IF NOT EXISTS idx_emails_account_date ON emails(account_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_emails_account_mailbox ON emails(account_id, mailbox);
    `)
    console.log('[db] Migration complete')
  }

  // Ensure mailbox index exists
  db.exec('CREATE INDEX IF NOT EXISTS idx_emails_account_mailbox ON emails(account_id, mailbox)')

  // Performance indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(account_id, mailbox, is_read);
    CREATE INDEX IF NOT EXISTS idx_emails_is_starred ON emails(is_starred) WHERE is_starred = 1;
    CREATE INDEX IF NOT EXISTS idx_emails_needs_body ON emails(account_id, date DESC) WHERE body IS NULL OR body = '';
  `)

  // FTS5 full-text search index for subject + body
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
      email_id UNINDEXED,
      subject,
      body,
      tokenize='unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS emails_fts_ai AFTER INSERT ON emails BEGIN
      INSERT INTO emails_fts(email_id, subject, body)
      VALUES (new.id, new.subject, new.body);
    END;

    CREATE TRIGGER IF NOT EXISTS emails_fts_au AFTER UPDATE OF subject, body ON emails BEGIN
      UPDATE emails_fts SET subject = new.subject, body = new.body
      WHERE email_id = new.id;
    END;

    CREATE TRIGGER IF NOT EXISTS emails_fts_ad AFTER DELETE ON emails BEGIN
      DELETE FROM emails_fts WHERE email_id = old.id;
    END;
  `)

  // Back-fill FTS index for any rows not yet indexed
  db.exec(`
    INSERT INTO emails_fts(email_id, subject, body)
    SELECT id, subject, body FROM emails
    WHERE id NOT IN (SELECT email_id FROM emails_fts)
  `)

  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
