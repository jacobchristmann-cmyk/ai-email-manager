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
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.username, pass: config.password },
    logger: false
  })
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

export async function fetchSeenUids(
  config: ImapConfig,
  mailbox: string = 'INBOX'
): Promise<Set<number>> {
  const client = createClient(config)
  const seenUids = new Set<number>()

  try {
    await client.connect()
    const lock = await client.getMailboxLock(mailbox)

    try {
      const results = await client.search({ seen: true }, { uid: true })
      for (const uid of results) {
        seenUids.add(uid)
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }

  return seenUids
}

export async function fetchEmails(config: ImapConfig, sinceUid: number = 0, mailbox: string = 'INBOX'): Promise<FetchedEmail[]> {
  const client = createClient(config)
  const emails: FetchedEmail[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock(mailbox)

    try {
      const mb = client.mailbox
      if (!mb || !mb.exists || mb.exists === 0) {
        return emails
      }

      let range: string
      let useUid: boolean

      if (sinceUid > 0) {
        range = `${sinceUid + 1}:*`
        useUid = true
      } else {
        // First sync: fetch all messages
        range = '1:*'
        useUid = false
      }

      // Only fetch envelope + flags (fast!) — no source/body download
      for await (const msg of client.fetch(range, { uid: useUid, envelope: true, flags: true })) {
        if (sinceUid > 0 && msg.uid <= sinceUid) continue

        const envelope = msg.envelope
        if (!envelope) continue

        const from = envelope.from?.[0]
          ? `${envelope.from[0].name || ''} <${envelope.from[0].address || ''}>`.trim()
          : ''
        const to = envelope.to?.[0]
          ? `${envelope.to[0].name || ''} <${envelope.to[0].address || ''}>`.trim()
          : ''

        emails.push({
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
        })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }

  return emails
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

        try {
          const parsed = await simpleParser(msg.source)
          const unsubHeader = parsed.headers.get('list-unsubscribe')
          const unsubPostHeader = parsed.headers.get('list-unsubscribe-post')
          return {
            body: parsed.text || '',
            bodyHtml: parsed.html || null,
            listUnsubscribe: typeof unsubHeader === 'string' ? unsubHeader : null,
            listUnsubscribePost: typeof unsubPostHeader === 'string' ? unsubPostHeader : null
          }
        } catch {
          return {
            body: msg.source.toString().slice(0, 5000),
            bodyHtml: null,
            listUnsubscribe: null,
            listUnsubscribePost: null
          }
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }

  return null
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
