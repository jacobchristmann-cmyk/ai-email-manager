import { listEmailsForAI, getEmail } from '../db/emailDao'
import { callAIChat, type ChatMessage } from './aiClient'
import type { Email } from '../../shared/types'

const MAX_EMAILS = 30
const MAX_BODY_SNIPPET = 500
const MAX_SINGLE_EMAIL_BODY = 3000

function buildEmailContext(emails: Email[]): string {
  if (emails.length === 0) return 'Keine E-Mails vorhanden.'

  const lines = emails.slice(0, MAX_EMAILS).map((e, i) => {
    const snippet = e.body.replace(/\s+/g, ' ').trim().slice(0, MAX_BODY_SNIPPET)
    return `[${i + 1}] Betreff: ${e.subject}\nVon: ${e.from}\nDatum: ${e.date}\nGelesen: ${e.isRead ? 'Ja' : 'Nein'}\nInhalt: ${snippet}`
  })

  return lines.join('\n\n')
}

function buildSingleEmailContext(email: Email): string {
  const body = email.body.replace(/\s+/g, ' ').trim().slice(0, MAX_SINGLE_EMAIL_BODY)
  return `Betreff: ${email.subject}\nVon: ${email.from}\nAn: ${email.to}\nDatum: ${email.date}\nGelesen: ${email.isRead ? 'Ja' : 'Nein'}\n\nVollständiger Inhalt:\n${body}`
}

export interface BriefingItem {
  emailId: string
  subject: string
  from: string
  mailbox: string
  category: 'important' | 'deadline' | 'newsletter' | 'other'
  summary: string
  deadline?: string
}

export interface Briefing {
  totalUnread: number
  items: BriefingItem[]
  overview: string
}

export async function generateBriefing(): Promise<Briefing> {
  // Load ALL unread emails across all accounts/mailboxes
  const allEmails = listEmailsForAI()
  const unread = allEmails.filter((e) => !e.isRead)

  if (unread.length === 0) {
    return {
      totalUnread: 0,
      items: [],
      overview: 'Keine ungelesenen E-Mails vorhanden. Dein Postfach ist aufgeräumt!'
    }
  }

  const emailsForPrompt = unread.slice(0, MAX_EMAILS).map((e) => {
    const snippet = e.body.replace(/\s+/g, ' ').trim().slice(0, MAX_BODY_SNIPPET)
    return { id: e.id, subject: e.subject, from: e.from, date: e.date, mailbox: e.mailbox, snippet }
  })

  const context = emailsForPrompt.map((e, i) =>
    `[${i + 1}] ID: ${e.id}\nPostfach: ${e.mailbox}\nBetreff: ${e.subject}\nVon: ${e.from}\nDatum: ${e.date}\nInhalt: ${e.snippet}`
  ).join('\n\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Du bist ein E-Mail-Assistent. Analysiere die ungelesenen E-Mails und erstelle ein strukturiertes Briefing.

Antworte AUSSCHLIESSLICH mit validem JSON in folgendem Format:
{
  "overview": "Kurze Zusammenfassung in 1-2 Sätzen",
  "items": [
    {
      "emailId": "die exakte ID der Email",
      "subject": "Betreff",
      "from": "Absender (nur Name)",
      "mailbox": "Postfach-Pfad",
      "category": "important|deadline|newsletter|other",
      "summary": "Kurze Zusammenfassung in einem Satz",
      "deadline": "Datum der Deadline falls vorhanden, sonst weglassen"
    }
  ]
}

Kategorisiere jede E-Mail:
- "important": Wichtige persönliche/geschäftliche E-Mails die Aufmerksamkeit erfordern
- "deadline": E-Mails mit Fristen, Terminen oder zeitkritischen Informationen
- "newsletter": Newsletter, Marketing, automatische Benachrichtigungen
- "other": Alles andere

Sortiere die Items nach Priorität: deadline zuerst, dann important, dann other, dann newsletter.
Gib die emailId EXAKT so zurück wie sie im Input steht.`
    },
    {
      role: 'user',
      content: `Hier sind ${unread.length} ungelesene E-Mails:\n\n${context}`
    }
  ]

  const raw = await callAIChat(messages)

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Kein JSON gefunden')
    const parsed = JSON.parse(jsonMatch[0]) as { overview: string; items: BriefingItem[] }
    return {
      totalUnread: unread.length,
      overview: parsed.overview,
      items: parsed.items || []
    }
  } catch {
    return {
      totalUnread: unread.length,
      overview: raw,
      items: []
    }
  }
}

export async function analyzeUnreadEmails(
  accountId?: string,
  mailbox?: string
): Promise<string> {
  const allEmails = listEmailsForAI(accountId, mailbox)
  const unread = allEmails.filter((e) => !e.isRead)

  if (unread.length === 0) {
    return 'Keine ungelesenen E-Mails vorhanden. Dein Postfach ist aufgeräumt!'
  }

  const context = buildEmailContext(unread)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Du bist ein hilfreicher E-Mail-Assistent. Analysiere die ungelesenen E-Mails und gib eine kurze Übersicht mit Handlungsempfehlungen. Antworte auf Deutsch in Markdown-Format. Strukturiere deine Antwort mit:
- Kurze Zusammenfassung (Anzahl, wichtigste Themen)
- Handlungsempfehlungen (priorisiert, was zuerst bearbeitet werden sollte)
- Hinweise auf dringende oder wichtige E-Mails`
    },
    {
      role: 'user',
      content: `Hier sind meine ${unread.length} ungelesenen E-Mails:\n\n${context}`
    }
  ]

  return callAIChat(messages)
}

export async function analyzeEmail(emailId: string): Promise<string> {
  const email = getEmail(emailId)
  if (!email) throw new Error('E-Mail nicht gefunden')

  const context = buildSingleEmailContext(email)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Du bist ein hilfreicher E-Mail-Assistent. Analysiere die folgende E-Mail detailliert. Antworte auf Deutsch in Markdown-Format. Strukturiere deine Antwort mit:
- **Zusammenfassung**: Worum geht es in der E-Mail?
- **Handlungsempfehlungen**: Was sollte der Nutzer tun?
- **Deadlines**: Gibt es Fristen oder zeitkritische Informationen?
- **Wichtige Details**: Weitere relevante Punkte`
    },
    {
      role: 'user',
      content: `Analysiere diese E-Mail:\n\n${context}`
    }
  ]

  return callAIChat(messages)
}

export async function chatWithContext(
  userMessages: { role: 'user' | 'assistant'; content: string }[],
  accountId?: string,
  mailbox?: string,
  focusedEmailId?: string
): Promise<string> {
  let systemContent: string

  if (focusedEmailId) {
    const focusedEmail = getEmail(focusedEmailId)
    if (focusedEmail) {
      const focusedContext = buildSingleEmailContext(focusedEmail)
      systemContent = `Du bist ein hilfreicher E-Mail-Assistent. Der Nutzer hat die folgende E-Mail ausgewählt und stellt Fragen dazu. Beantworte die Fragen präzise und hilfreich. Antworte auf Deutsch in Markdown-Format.

Ausgewählte E-Mail:
${focusedContext}`
    } else {
      systemContent = buildFallbackContext(accountId, mailbox)
    }
  } else {
    systemContent = buildFallbackContext(accountId, mailbox)
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...userMessages
  ]

  return callAIChat(messages)
}

function buildFallbackContext(accountId?: string, mailbox?: string): string {
  const allEmails = listEmailsForAI(accountId, mailbox)
  const context = buildEmailContext(allEmails.slice(0, MAX_EMAILS))
  return `Du bist ein hilfreicher E-Mail-Assistent. Du hast Zugriff auf folgende E-Mails des Nutzers. Beantworte Fragen zu diesen E-Mails präzise und hilfreich. Antworte auf Deutsch in Markdown-Format.

E-Mails:
${context}`
}
