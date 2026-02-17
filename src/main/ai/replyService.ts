import { getEmail } from '../db/emailDao'
import { callAI } from './aiClient'
import type { SmartReplyResult } from '../../shared/types'

function buildPrompt(subject: string, from: string, body: string, language: string): string {
  const snippet = body.replace(/\s+/g, ' ').slice(0, 1500)

  return `You are an email reply assistant. Write ALL replies in ${language}.

--- EMAIL START ---
From: ${from}
Subject: ${subject}

${snippet}
--- EMAIL END ---

Generate reply suggestions. Every single word of every reply MUST be in ${language}.

- "shortReplies": 3 short reply options (1-2 sentences each), covering agreement, follow-up question, and decline/postpone.
- "fullReply": 1 detailed professional reply (3-5 sentences).

Respond with ONLY a JSON object, no other text:
{"shortReplies": ["...", "...", "..."], "fullReply": "..."}`
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

export async function generateSmartReplies(emailId: string, language: string): Promise<SmartReplyResult> {
  const email = getEmail(emailId)
  if (!email) {
    throw new Error('E-Mail nicht gefunden.')
  }

  const prompt = buildPrompt(email.subject, email.from, email.body, language)
  const response = await callAI(prompt)
  return parseResponse(response)
}
