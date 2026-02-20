import { getEmail, updateEmailActionItems } from '../db/emailDao'
import { callAI } from './aiClient'
import type { ActionItem } from '../../shared/types'

export async function detectEmailActions(emailId: string): Promise<ActionItem[]> {
  const email = getEmail(emailId)
  if (!email || !email.body) return []

  // Return cached result if already detected
  if (email.actionItems.length > 0) return email.actionItems

  const snippet = email.body.replace(/\s+/g, ' ').slice(0, 1500)
  const prompt = `Analysiere diese E-Mail und extrahiere konkrete Aufgaben, die der Empfänger erledigen muss.

Von: ${email.from}
Betreff: ${email.subject}
Inhalt: ${snippet}

Antworte NUR mit einem JSON-Array. Format: [{"type":"reply|deadline|confirm|document|meeting|other","text":"kurze Beschreibung der Aufgabe","dueDate":"ISO-Datum oder null"}]
Keine Aufgaben → leeres Array: []
Kein erklärender Text, nur das JSON-Array.`

  try {
    const response = await callAI(prompt)
    const match = response.match(/\[[\s\S]*?\]/)
    if (!match) {
      updateEmailActionItems(emailId, [])
      return []
    }
    const items = JSON.parse(match[0]) as ActionItem[]
    updateEmailActionItems(emailId, items)
    return items
  } catch {
    updateEmailActionItems(emailId, [])
    return []
  }
}
