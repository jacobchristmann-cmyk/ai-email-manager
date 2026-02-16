import { listEmails } from '../db/emailDao'
import { callAI } from './aiClient'
import type { Email } from '../../shared/types'

const MAX_AI_EMAILS = 40

function buildSearchPrompt(
  query: string,
  emails: { id: string; from: string; subject: string; snippet: string }[]
): string {
  // Compact single-line format to minimize tokens
  const emailList = emails
    .map((e) => `[${e.id}] ${e.from} | ${e.subject} | ${e.snippet}`)
    .join('\n')

  return `Suche: "${query}"

Finde semantisch relevante E-Mails. Berücksichtige Synonyme und verwandte Begriffe (z.B. "Rechnung"="Invoice","Abrechnung","Zahlung").

${emailList}

Antworte NUR mit JSON-Array der relevanten IDs, relevanteste zuerst: ["id-1","id-2"]
Keine relevant? []`
}

function parseIdArrayResponse(content: string): string[] {
  const jsonMatch = content.match(/\[[\s\S]*?\]/)
  if (!jsonMatch) return []

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string')
    }
  } catch {
    // Failed to parse
  }
  return []
}

/**
 * Pre-filter: score emails by basic keyword overlap with the query.
 * Emails with any keyword hit get priority; the rest fill remaining slots.
 */
function prefilterEmails(
  emails: Email[],
  query: string,
  limit: number
): Email[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)

  if (words.length === 0) return emails.slice(0, limit)

  const scored: { email: Email; score: number }[] = emails.map((e) => {
    const haystack = `${e.subject} ${e.from} ${e.body.slice(0, 300)}`.toLowerCase()
    let score = 0
    for (const w of words) {
      if (haystack.includes(w)) score++
    }
    return { email: e, score }
  })

  // Sort: keyword-matching emails first, then the rest (preserve recency within groups)
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((s) => s.email)
}

export async function aiSearchEmails(
  query: string,
  accountId?: string,
  mailbox?: string
): Promise<string[]> {
  if (!query.trim()) return []

  const allEmails = listEmails(accountId, mailbox)
  if (allEmails.length === 0) return []

  // Pre-filter to most relevant candidates to keep prompt small
  const emails = prefilterEmails(allEmails, query, MAX_AI_EMAILS)

  const emailData = emails.map((e) => ({
    id: e.id,
    from: e.from,
    subject: e.subject,
    snippet: e.body.replace(/\s+/g, ' ').slice(0, 80)
  }))

  const prompt = buildSearchPrompt(query, emailData)
  const response = await callAI(prompt)
  const ids = parseIdArrayResponse(response)

  const validIds = new Set(emails.map((e) => e.id))
  return ids.filter((id) => validIds.has(id))
}
