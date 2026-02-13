import { ImapFlow } from 'imapflow'

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
        if (msg.source) {
          body = extractTextBody(msg.source.toString())
        }

        emails.push({
          uid: msg.uid,
          messageId: envelope.messageId || `unknown-${msg.uid}`,
          subject: envelope.subject || '(kein Betreff)',
          from,
          to,
          date: envelope.date ? envelope.date.toISOString() : new Date().toISOString(),
          body
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

function extractTextBody(source: string): string {
  // Simple text extraction from raw email source
  // Look for text/plain content or fall back to stripping HTML
  const parts = source.split(/\r?\n\r?\n/)
  if (parts.length < 2) return ''

  // Skip the headers, get everything after the first blank line
  const bodyPart = parts.slice(1).join('\n\n')

  // If it's a multipart message, try to find text/plain
  if (source.includes('Content-Type: text/plain')) {
    const textMatch = bodyPart.match(
      /Content-Type: text\/plain[^\r\n]*\r?\n(?:Content-Transfer-Encoding:[^\r\n]*\r?\n)?(?:\r?\n)([\s\S]*?)(?:--[^\r\n]+|$)/i
    )
    if (textMatch) return decodeBody(textMatch[1].trim())
  }

  // For simple non-multipart messages
  if (!source.includes('boundary=')) {
    return decodeBody(bodyPart.trim()).slice(0, 5000)
  }

  // Fallback: strip HTML tags if we find HTML content
  const htmlStripped = bodyPart.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return htmlStripped.slice(0, 5000)
}

function decodeBody(text: string): string {
  // Handle quoted-printable
  if (text.includes('=\r\n') || text.includes('=\n') || /=[0-9A-F]{2}/i.test(text)) {
    try {
      return text
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    } catch {
      return text
    }
  }
  // Handle base64
  if (/^[A-Za-z0-9+/\r\n]+=*$/.test(text.trim())) {
    try {
      return Buffer.from(text.replace(/\s/g, ''), 'base64').toString('utf-8')
    } catch {
      return text
    }
  }
  return text
}
