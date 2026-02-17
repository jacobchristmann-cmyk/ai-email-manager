import { listEmailsForAI } from '../db/emailDao'
import { listCategories, updateEmailCategories, listCategoryCorrections } from '../db/categoryDao'
import { callAI } from './aiClient'
import type { Category, Email } from '../../shared/types'

function buildPrompt(
  categories: Category[],
  emails: { id: string; subject: string; from: string; snippet: string }[],
  corrections: { subject: string; from: string; snippet: string; categoryId: string }[]
): string {
  const catList = categories.map((c) => `- ${c.id}: ${c.name} (${c.description})`).join('\n')
  const emailList = emails
    .map(
      (e, i) =>
        `${i + 1}. ID: ${e.id}\n   Von: ${e.from}\n   Betreff: ${e.subject}\n   Vorschau: ${e.snippet}`
    )
    .join('\n')

  let trainingSection = ''
  if (corrections.length > 0) {
    const examples = corrections
      .map(
        (c) => `- Von: ${c.from} | Betreff: ${c.subject} → ${c.categoryId}`
      )
      .join('\n')
    trainingSection = `\n\nDer Benutzer hat folgende E-Mails manuell kategorisiert. Lerne aus diesen Beispielen und wende ähnliche Zuordnungen an:\n${examples}\n`
  }

  return `Du bist ein E-Mail-Klassifikator. Ordne jede E-Mail einer Kategorie zu.

Verfügbare Kategorien:
${catList}
${trainingSection}
E-Mails:
${emailList}

Antworte NUR mit einem JSON-Objekt, das E-Mail-IDs auf Kategorie-IDs abbildet.
Beispiel: {"email-id-1": "cat-arbeit", "email-id-2": "cat-newsletter"}
Keine Erklärungen, nur JSON.`
}

function parseJsonResponse(content: string): Record<string, string> {
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return {}

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (typeof parsed === 'object' && parsed !== null) {
      const result: Record<string, string> = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          result[key] = value
        }
      }
      return result
    }
  } catch {
    // Failed to parse JSON
  }
  return {}
}

async function classifyBatch(
  emails: Email[],
  categories: Category[]
): Promise<Record<string, string>> {
  const emailData = emails.map((e) => ({
    id: e.id,
    subject: e.subject,
    from: e.from,
    snippet: e.body.replace(/\s+/g, ' ').slice(0, 200)
  }))

  const corrections = listCategoryCorrections()
  const prompt = buildPrompt(categories, emailData, corrections)
  const response = await callAI(prompt)
  return parseJsonResponse(response)
}

export async function classifyEmails(emailIds: string[]): Promise<Record<string, string>> {
  const categories = listCategories()
  if (categories.length === 0) {
    throw new Error('Keine Kategorien vorhanden.')
  }

  const allEmails = listEmailsForAI()
  const targetEmails = allEmails.filter((e) => emailIds.includes(e.id))

  if (targetEmails.length === 0) return {}

  const allResults: Record<string, string> = {}
  const batchSize = 10

  for (let i = 0; i < targetEmails.length; i += batchSize) {
    const batch = targetEmails.slice(i, i + batchSize)
    const results = await classifyBatch(batch, categories)
    Object.assign(allResults, results)
  }

  // Validate category IDs
  const validCatIds = new Set(categories.map((c) => c.id))
  const validResults: Record<string, string> = {}
  for (const [emailId, catId] of Object.entries(allResults)) {
    if (validCatIds.has(catId)) {
      validResults[emailId] = catId
    }
  }

  if (Object.keys(validResults).length > 0) {
    updateEmailCategories(validResults)
  }

  return validResults
}

export async function classifyAllEmails(): Promise<Record<string, string>> {
  const allEmails = listEmailsForAI()
  const uncategorized = allEmails.filter((e) => !e.categoryId)

  if (uncategorized.length === 0) return {}

  const emailIds = uncategorized.map((e) => e.id)
  return classifyEmails(emailIds)
}
