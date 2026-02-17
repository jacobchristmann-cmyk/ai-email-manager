import { getEmail } from '../db/emailDao'
import { callAI } from './aiClient'
import type { SmartReplyResult } from '../../shared/types'

function buildPrompt(subject: string, from: string, body: string): string {
  const snippet = body.replace(/\s+/g, ' ').slice(0, 1500)

  return `You are an email reply assistant. Generate reply suggestions for the following email.

CRITICAL: Detect the language of the email below and write ALL replies in that SAME language. If the email is in English, reply in English. If in German, reply in German. If in French, reply in French. Etc.

From: ${from}
Subject: ${subject}
Content: ${snippet}

Generate:
1. Three short reply options (1-2 sentences each) covering typical reactions (e.g. agreement, follow-up question, decline/postpone).
2. One detailed, professional reply (3-5 sentences).

ALL reply text MUST be in the same language as the email above.

Respond ONLY with a JSON object in this exact format:
{"shortReplies": ["Short reply 1", "Short reply 2", "Short reply 3"], "fullReply": "Detailed reply here..."}
No explanations, only JSON.`
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
