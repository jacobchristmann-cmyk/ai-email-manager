import { getAllSettings, setSetting } from '../db/settingsDao'
import { refreshGoogleToken } from './googleOAuth'

async function callOpenAIText(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
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
  return data.choices[0]?.message?.content ?? ''
}

async function callAnthropicText(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
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
  return data.content.find((c) => c.type === 'text')?.text ?? ''
}

async function callGeminiText(
  accessToken: string,
  model: string,
  prompt: string
): Promise<string> {
  const geminiModel = model || 'gemini-2.0-flash'
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Gemini API Fehler (${response.status}): ${text}`)
  }

  const data = (await response.json()) as {
    candidates: { content: { parts: { text: string }[] } }[]
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function getGoogleAccessToken(settings: Record<string, string>): Promise<string> {
  const accessToken = settings.googleAccessToken
  const refreshToken = settings.googleRefreshToken
  const expiresAt = parseInt(settings.googleTokenExpiry || '0', 10)
  const clientId = settings.googleClientId
  const clientSecret = settings.googleClientSecret

  if (!accessToken || !refreshToken) {
    throw new Error('Nicht bei Google angemeldet. Bitte in den Einstellungen anmelden.')
  }

  if (Date.now() > expiresAt - 60_000) {
    if (!clientId || !clientSecret) {
      throw new Error('Google Client-ID/Secret nicht konfiguriert.')
    }
    const refreshed = await refreshGoogleToken(clientId, clientSecret, refreshToken)
    setSetting('googleAccessToken', refreshed.accessToken)
    setSetting('googleTokenExpiry', String(refreshed.expiresAt))
    return refreshed.accessToken
  }

  return accessToken
}

export async function callAI(prompt: string): Promise<string> {
  const settings = getAllSettings()
  const provider = settings.aiProvider || 'openai'
  const apiKey = settings.aiApiKey
  const model = settings.aiModel || ''

  if (provider === 'google') {
    if (!settings.googleAccessToken || !settings.googleRefreshToken) {
      throw new Error('Nicht bei Google angemeldet. Bitte in den Einstellungen anmelden.')
    }
    const accessToken = await getGoogleAccessToken(settings)
    return callGeminiText(accessToken, model, prompt)
  }

  if (!apiKey?.trim()) {
    throw new Error('Kein API-Schlüssel konfiguriert. Bitte in den Einstellungen hinterlegen.')
  }

  if (provider === 'anthropic') {
    return callAnthropicText(apiKey, model, prompt)
  }

  return callOpenAIText(apiKey, model, prompt)
}
