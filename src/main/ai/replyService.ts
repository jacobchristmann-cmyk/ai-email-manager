import { getEmail } from '../db/emailDao'
import { callAI } from './aiClient'
import type { SmartReplyResult } from '../../shared/types'

function buildPrompt(subject: string, from: string, body: string): string {
  const snippet = body.replace(/\s+/g, ' ').slice(0, 1500)

  return `You are an email reply assistant.

Read the following email. Focus on the SUBJECT LINE and the FIRST PARAGRAPH to determine the language.

--- EMAIL START ---
From: ${from}
Subject: ${subject}

${snippet}
--- EMAIL END ---

Generate reply suggestions. You MUST first output the detected language in the "language" field, then write ALL replies in that exact language.

- "language": The language of the email subject and first paragraph (e.g. "English", "German", "French")
- "shortReplies": 3 short reply options (1-2 sentences each), covering agreement, follow-up question, and decline/postpone. Written in the detected language.
- "fullReply": 1 detailed professional reply (3-5 sentences). Written in the detected language.

If the subject is "Meeting tomorrow" → language is English → all replies in English.
If the subject is "Treffen morgen" → language is German → all replies in German.

Respond with ONLY a JSON object, no other text:
{"language": "...", "shortReplies": ["...", "...", "..."], "fullReply": "..."}`
}

function parseResponse(content: string): SmartReplyResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('KI-Antwort enthielt kein gültiges JSON.')
  }

  const parsed = JSON.parse(jsonMatch[0])

  if (
    !Array.isArray(parsed.shortReplies) ||
    parsed.shortReplies.length < 1 ||
    typeof parsed.fullReply !== 'string'
  ) {
    throw new Error('KI-Antwort hat ein unerwartetes Format.')
  }

  return {
    shortReplies: parsed.shortReplies.slice(0, 3).map(String),
    fullReply: String(parsed.fullReply)
  }
}

export async function generateSmartReplies(emailId: string): Promise<SmartReplyResult> {
  const email = getEmail(emailId)
  if (!email) {
    throw new Error('E-Mail nicht gefunden.')
  }

  const prompt = buildPrompt(email.subject, email.from, email.body)
  const response = await callAI(prompt)
  return parseResponse(response)
}
