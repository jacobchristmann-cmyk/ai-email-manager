import { getEmail } from '../db/emailDao'
import { callAI } from './aiClient'
import type { SmartReplyResult } from '../../shared/types'

function buildPrompt(subject: string, from: string, body: string): string {
  const snippet = body.replace(/\s+/g, ' ').slice(0, 1500)

  return `Du bist ein hilfreicher E-Mail-Assistent. Generiere Antwortvorschläge für die folgende E-Mail.

Von: ${from}
Betreff: ${subject}
Inhalt: ${snippet}

WICHTIG: Erkenne die Sprache der E-Mail und formuliere alle Antworten in derselben Sprache. Wenn die E-Mail auf Englisch ist, antworte auf Englisch. Wenn sie auf Deutsch ist, antworte auf Deutsch. Usw.

Generiere:
1. Drei kurze Antwortoptionen (jeweils 1-2 Sätze), die typische Reaktionen abdecken (z.B. Zustimmung, Nachfrage, Ablehnung/Verschiebung).
2. Eine ausführliche, professionelle Antwort (3-5 Sätze).

Antworte NUR mit einem JSON-Objekt in diesem Format:
{"shortReplies": ["Kurze Antwort 1", "Kurze Antwort 2", "Kurze Antwort 3"], "fullReply": "Ausführliche Antwort hier..."}
Keine Erklärungen, nur JSON.`
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
