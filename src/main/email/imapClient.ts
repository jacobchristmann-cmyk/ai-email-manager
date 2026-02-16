import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

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
}

export async function testImapConnection(config: ImapConfig): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.username, pass: config.password },
    logger: false
  })
  await client.connect()
  await client.logout()
}

export async function fetchEmails(config: ImapConfig, sinceUid: number = 0): Promise<FetchedEmail[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.username, pass: config.password },
    logger: false
  })

  const emails: FetchedEmail[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      const mailbox = client.mailbox
      if (!mailbox || !mailbox.exists || mailbox.exists === 0) {
        return emails
      }

      let range: string
      if (sinceUid > 0) {
        range = `${sinceUid + 1}:*`
      } else {
        // First sync: last 50 messages by sequence number
        const total = mailbox.exists
        const start = Math.max(1, total - 49)
        range = `${start}:*`
      }

      const fetchOptions = {
        uid: sinceUid > 0,
        envelope: true,
        source: true
      }

      for await (const msg of client.fetch(range, fetchOptions)) {
        const envelope = msg.envelope
        if (!envelope) continue

        const from = envelope.from?.[0]
          ? `${envelope.from[0].name || ''} <${envelope.from[0].address || ''}>`.trim()
          : ''
        const to = envelope.to?.[0]
          ? `${envelope.to[0].name || ''} <${envelope.to[0].address || ''}>`.trim()
          : ''

        let body = ''
        let bodyHtml: string | null = null

        if (msg.source) {
          try {
            const parsed = await simpleParser(msg.source)
            body = parsed.text || ''
            bodyHtml = parsed.html || null
          } catch {
            // Fallback: use raw source without parsing
            body = msg.source.toString().slice(0, 5000)
          }
        }

        emails.push({
          uid: msg.uid,
          messageId: envelope.messageId || `unknown-${msg.uid}`,
          subject: envelope.subject || '(kein Betreff)',
          from,
          to,
          date: envelope.date ? envelope.date.toISOString() : new Date().toISOString(),
          body,
          bodyHtml
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
