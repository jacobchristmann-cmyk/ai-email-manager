import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { Mailbox } from '../../shared/types'

export interface ImapConfig {
  host: string
  port: number
  username: string
  password: string
}

export interface FetchedEmail {
  uid: number
  messageId: string
  subject: string
  from: string
  to: string
  date: string
  body: string
  bodyHtml: string | null
  listUnsubscribe: string | null
  listUnsubscribePost: string | null
  isSeen: boolean
}

function createClient(config: ImapConfig): ImapFlow {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.username, pass: config.password },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 90000  // 90s — generous for syncing many mailboxes in sequence
  })
  // Prevent "Uncaught Exception" when an error event fires without an active awaited operation
  client.on('error', (err) => {
    console.error('[IMAP] Connection error (non-fatal):', err.message)
  })
  return client
}

export async function testImapConnection(config: ImapConfig): Promise<void> {
  const client = createClient(config)
  await client.connect()
  await client.logout()
}

export async function listMailboxes(config: ImapConfig): Promise<Mailbox[]> {
  const client = createClient(config)
  try {
    await client.connect()
    const list = await client.list()
    return list
      .filter((mb) => !mb.flags?.has('\\Noselect') && !mb.flags?.has('\\NonExistent'))
      .map((mb) => ({
        name: mb.name,
        path: mb.path,
        specialUse: mb.specialUse || undefined
      }))
  } finally {
    await client.logout().catch(() => {})
  }
}

// === Per-mailbox sync input/output for the pooled syncMailboxes function ===

export interface MailboxSyncInput {
  path: string
  sinceUid: number
  /** UIDs that are currently unread in local DB — used for targeted seen-flag check */
  localUnreadUids: number[]
}

export interface MailboxSyncResult {
  path: string
  newEmails: FetchedEmail[]
  maxUid: number
  /** UIDs whose \Seen flag was set on the server since our last check */
  uidsToMarkRead: number[]
}

function parseEnvelopeToEmail(msg: { uid: number; envelope?: { messageId?: string; subject?: string; from?: { name?: string; address?: string }[]; to?: { name?: string; address?: string }[]; date?: Date }; flags?: Set<string> }): FetchedEmail {
  const envelope = msg.envelope!
  const from = envelope.from?.[0]
    ? `${envelope.from[0].name || ''} <${envelope.from[0].address || ''}>`.trim()
    : ''
  const to = envelope.to?.[0]
    ? `${envelope.to[0].name || ''} <${envelope.to[0].address || ''}>`.trim()
    : ''
  return {
    uid: msg.uid,
    messageId: envelope.messageId || `unknown-${msg.uid}`,
    subject: envelope.subject || '(kein Betreff)',
    from,
    to,
    date: envelope.date ? envelope.date.toISOString() : new Date().toISOString(),
    body: '',
    bodyHtml: null,
    listUnsubscribe: null,
    listUnsubscribePost: null,
    isSeen: msg.flags?.has('\\Seen') ?? false
  }
}

/**
 * Syncs multiple mailboxes using a single IMAP connection.
 * For each mailbox: fetches new emails (envelope only) and checks
 * the \Seen flag only for the UIDs that are locally unread.
 */
export async function syncMailboxes(
  config: ImapConfig,
  inputs: MailboxSyncInput[]
): Promise<MailboxSyncResult[]> {
  const client = createClient(config)
  const results: MailboxSyncResult[] = []

  try {
    await client.connect()

    for (const input of inputs) {
      const result: MailboxSyncResult = {
        path: input.path,
        newEmails: [],
        maxUid: input.sinceUid,
        uidsToMarkRead: []
      }

      const lock = await client.getMailboxLock(input.path)
      try {
        const mb = client.mailbox
        if (!mb || !mb.exists || mb.exists === 0) {
          results.push(result)
          continue
        }

        // 1. Fetch new emails (envelope + flags only, no body)
        if (input.sinceUid > 0) {
          for await (const msg of client.fetch(`${input.sinceUid + 1}:*`, { uid: true, envelope: true, flags: true })) {
            if (msg.uid <= input.sinceUid || !msg.envelope) continue
            result.newEmails.push(parseEnvelopeToEmail(msg))
            result.maxUid = Math.max(result.maxUid, msg.uid)
          }
        } else {
          // First sync: fetch all by sequence number
          for await (const msg of client.fetch('1:*', { uid: false, envelope: true, flags: true })) {
            if (!msg.envelope) continue
            result.newEmails.push(parseEnvelopeToEmail(msg))
            result.maxUid = Math.max(result.maxUid, msg.uid)
          }
        }

        // 2. Targeted seen-flag check: only for UIDs we know are locally unread
        if (input.localUnreadUids.length > 0) {
          const uidSet = input.localUnreadUids.join(',')
          for await (const msg of client.fetch(uidSet, { flags: true }, { uid: true })) {
            if (msg.flags?.has('\\Seen')) {
              result.uidsToMarkRead.push(msg.uid)
            }
          }
        }
      } finally {
        lock.release()
      }

      results.push(result)
    }
  } finally {
    await client.logout().catch(() => {})
  }

  return results
}

/** Fetch full body for a single email by UID */
export async function fetchEmailBody(
  config: ImapConfig,
  uid: number,
  mailbox: string = 'INBOX'
): Promise<{ body: string; bodyHtml: string | null; listUnsubscribe: string | null; listUnsubscribePost: string | null } | null> {
  const client = createClient(config)

  try {
    await client.connect()
    const lock = await client.getMailboxLock(mailbox)

    try {
      for await (const msg of client.fetch(String(uid), { uid: true, source: true })) {
        if (!msg.source) return null
        return await parseSource(msg.source)
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }

  return null
}

export type BodyData = { body: string; bodyHtml: string | null; listUnsubscribe: string | null; listUnsubscribePost: string | null }

async function parseSource(source: Buffer): Promise<BodyData> {
  try {
    const parsed = await simpleParser(source)
    const unsubHeader = parsed.headers.get('list-unsubscribe')
    const unsubPostHeader = parsed.headers.get('list-unsubscribe-post')
    return {
      body: parsed.text || '',
      bodyHtml: parsed.html || null,
      listUnsubscribe: typeof unsubHeader === 'string' ? unsubHeader : null,
      listUnsubscribePost: typeof unsubPostHeader === 'string' ? unsubPostHeader : null
    }
  } catch {
    return { body: source.toString().slice(0, 5000), bodyHtml: null, listUnsubscribe: null, listUnsubscribePost: null }
  }
}

/**
 * Batch-fetch email bodies for multiple UIDs in a single mailbox using one IMAP connection.
 * Returns a Map<uid, BodyData> for all successfully fetched messages.
 */
export async function fetchEmailBodiesInMailbox(
  config: ImapConfig,
  mailbox: string,
  uids: number[]
): Promise<Map<number, BodyData>> {
  if (uids.length === 0) return new Map()
  const client = createClient(config)
  const results = new Map<number, BodyData>()

  try {
    await client.connect()
    const lock = await client.getMailboxLock(mailbox)
    try {
      const uidSet = uids.join(',')
      for await (const msg of client.fetch(uidSet, { uid: true, source: true }, { uid: true })) {
        if (msg.source) {
          results.set(msg.uid, await parseSource(msg.source))
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }

  return results
}

export async function createMailbox(config: ImapConfig, path: string): Promise<boolean> {
  const client = createClient(config)
  try {
    await client.connect()
    const result = await client.mailboxCreate(path)
    console.log('[IMAP] mailboxCreate result:', JSON.stringify(result))
    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('ALREADYEXISTS')) {
      console.log('[IMAP] Mailbox already exists:', path)
      return true
    }
    console.error('[IMAP] Failed to create mailbox:', path, err)
    throw err
  } finally {
    await client.logout().catch(() => {})
  }
}

export async function markEmailSeen(config: ImapConfig, uid: number, mailbox: string): Promise<void> {
  const client = createClient(config)
  try {
    await client.connect()
    const lock = await client.getMailboxLock(mailbox)
    try {
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

export async function markEmailUnseen(config: ImapConfig, uid: number, mailbox: string): Promise<void> {
  const client = createClient(config)
  try {
    await client.connect()
    const lock = await client.getMailboxLock(mailbox)
    try {
      await client.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true })
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

export async function moveEmail(
  config: ImapConfig,
  uid: number,
  fromMailbox: string,
  toMailbox: string
): Promise<void> {
  const client = createClient(config)
  try {
    await client.connect()
    const lock = await client.getMailboxLock(fromMailbox)
    try {
      await client.messageMove(String(uid), toMailbox, { uid: true })
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}
