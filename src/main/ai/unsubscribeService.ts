import { getEmail } from '../db/emailDao'

// Keywords in href URLs or link text
const UNSUBSCRIBE_KEYWORDS = /unsubscribe|abmelden|abbestellen|abmeldung|opt[\s-]?out|austragen|newsletter[\s_-]?(abm|unsub|remove|stop)/i

// Broader context patterns: text near a link that hints at unsubscribe
const CONTEXT_KEYWORDS = /abmeld|abbestell|austrag|unsubscri|opt[\s-]?out|newsletter.{0,20}(abm|hier|click|klick)|hier.{0,30}abm/i

/**
 * Extract an HTTP(S) URL from a List-Unsubscribe header value.
 * Format is typically: <https://example.com/unsub>, <mailto:unsub@example.com>
 */
function extractUrlFromHeader(header: string): string | null {
  const matches = header.match(/<(https?:\/\/[^>]+)>/i)
  return matches ? matches[1] : null
}

/**
 * Strip HTML tags to get plain text.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')
}

/**
 * Search the HTML body for an unsubscribe link as fallback.
 * Checks: 1) href URL, 2) link text, 3) surrounding context (~150 chars around the link).
 */
function extractUrlFromHtml(html: string): string | null {
  const linkRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  // First pass: direct keyword match in href or link text
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]
    const text = stripHtml(match[2])
    if (!href.startsWith('http')) continue
    if (UNSUBSCRIBE_KEYWORDS.test(href) || UNSUBSCRIBE_KEYWORDS.test(text)) {
      return href
    }
  }

  // Second pass: check surrounding context (e.g. "hier zur Abmeldung" where "hier" is the link)
  linkRegex.lastIndex = 0
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]
    if (!href.startsWith('http')) continue
    const start = Math.max(0, match.index - 150)
    const end = Math.min(html.length, match.index + match[0].length + 150)
    const context = stripHtml(html.slice(start, end))
    if (CONTEXT_KEYWORDS.test(context)) {
      return href
    }
  }

  return null
}

export interface UnsubscribeResult {
  method: 'post' | 'browser'
  url: string
}

/**
 * Try RFC 8058 One-Click Unsubscribe via POST.
 * Returns true if the POST was successful (2xx response).
 */
async function tryOneClickPost(url: string, postValue: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postValue
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Find the best unsubscribe method for an email.
 * Returns the URL and preferred method, or null if no link found.
 */
export async function unsubscribe(emailId: string): Promise<UnsubscribeResult | null> {
  const email = getEmail(emailId)
  if (!email) return null

  // 1. Try One-Click POST (RFC 8058) if both headers are present
  if (email.listUnsubscribe && email.listUnsubscribePost) {
    const url = extractUrlFromHeader(email.listUnsubscribe)
    if (url) {
      const success = await tryOneClickPost(url, email.listUnsubscribePost)
      if (success) {
        return { method: 'post', url }
      }
      // POST failed — fall through to browser
    }
  }

  // 2. Try List-Unsubscribe header URL (open in browser)
  if (email.listUnsubscribe) {
    const url = extractUrlFromHeader(email.listUnsubscribe)
    if (url) return { method: 'browser', url }
  }

  // 3. Fallback: parse HTML body
  if (email.bodyHtml) {
    const url = extractUrlFromHtml(email.bodyHtml)
    if (url) return { method: 'browser', url }
  }

  return null
}
