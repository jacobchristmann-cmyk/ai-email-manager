import { getAllSettings } from '../db/settingsDao'
import { listEmails } from '../db/emailDao'
import { listCategories, updateEmailCategories } from '../db/categoryDao'
import type { Category, Email } from '../../shared/types'

function buildPrompt(categories: Category[], emails: { id: string; subject: string; from: string; snippet: string }[]): string {
  const catList = categories.map((c) => `- ${c.id}: ${c.name} (${c.description})`).join('\n')
  const emailList = emails
    .map(
      (e, i) =>
        `${i + 1}. ID: ${e.id}\n   Von: ${e.from}\n   Betreff: ${e.subject}\n   Vorschau: ${e.snippet}`
    )
    .join('\n')

  return `Du bist ein E-Mail-Klassifikator. Ordne jede E-Mail einer Kategorie zu.

Verfügbare Kategorien:
${catList}

E-Mails:
${emailList}

Antworte NUR mit einem JSON-Objekt, das E-Mail-IDs auf Kategorie-IDs abbildet.
Beispiel: {"email-id-1": "cat-arbeit", "email-id-2": "cat-newsletter"}
Keine Erklärungen, nur JSON.`
}

async function callOpenAI(
  apiKey: string,
  model: string,
  prompt: string
): Promise<Record<string, string>> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI API Fehler (${response.status}): ${text}`)
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[]
  }
  const content = data.choices[0]?.message?.content ?? '{}'
  return parseJsonResponse(content)
}

async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string
): Promise<Record<string, string>> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Anthropic API Fehler (${response.status}): ${text}`)
  }

  const data = (await response.json()) as {
    content: { type: string; text: string }[]
  }
  const content = data.content.find((c) => c.type === 'text')?.text ?? '{}'
  return parseJsonResponse(content)
}

function parseJsonResponse(content: string): Record<string, string> {
  // Extract JSON from response (handle markdown code blocks)
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
  categories: Category[],
  provider: string,
  apiKey: string,
  model: string
): Promise<Record<string, string>> {
  const emailData = emails.map((e) => ({
    id: e.id,
    subject: e.subject,
    from: e.from,
    snippet: e.body.replace(/\s+/g, ' ').slice(0, 200)
  }))

  const prompt = buildPrompt(categories, emailData)

  if (provider === 'anthropic') {
    return callAnthropic(apiKey, model, prompt)
  }
  return callOpenAI(apiKey, model, prompt)
}

export async function classifyEmails(emailIds: string[]): Promise<Record<string, string>> {
  const settings = getAllSettings()
  const provider = settings.aiProvider || 'openai'
  const apiKey = settings.aiApiKey
  const model = settings.aiModel || ''

  if (!apiKey?.trim()) {
    throw new Error('Kein API-Schlüssel konfiguriert. Bitte in den Einstellungen hinterlegen.')
  }

  const categories = listCategories()
  if (categories.length === 0) {
    throw new Error('Keine Kategorien vorhanden.')
  }

  const allEmails = listEmails()
  const targetEmails = allEmails.filter((e) => emailIds.includes(e.id))

  if (targetEmails.length === 0) return {}

  const allResults: Record<string, string> = {}
  const batchSize = 10

  for (let i = 0; i < targetEmails.length; i += batchSize) {
    const batch = targetEmails.slice(i, i + batchSize)
    const results = await classifyBatch(batch, categories, provider, apiKey, model)
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
  const allEmails = listEmails()
  const uncategorized = allEmails.filter((e) => !e.categoryId)

  if (uncategorized.length === 0) return {}

  const emailIds = uncategorized.map((e) => e.id)
  return classifyEmails(emailIds)
}
