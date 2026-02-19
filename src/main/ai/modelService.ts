import { getAllSettings, setSetting } from '../db/settingsDao'
import { refreshGoogleToken } from './googleOAuth'

interface ModelInfo {
  id: string
  name: string
}

export interface ListModelsParams {
  provider: string
  apiKey?: string
}

// ── Hardcoded default model lists (always available, no API key needed) ──

const OPENAI_DEFAULTS: ModelInfo[] = [
  { id: 'gpt-4.1', name: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'o3', name: 'o3' },
  { id: 'o3-mini', name: 'o3 Mini' },
  { id: 'o4-mini', name: 'o4 Mini' }
]

const ANTHROPIC_DEFAULTS: ModelInfo[] = [
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' }
]

const GOOGLE_DEFAULTS: ModelInfo[] = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' }
]

const OLLAMA_DEFAULTS: ModelInfo[] = [
  { id: 'gpt-oss:20b', name: 'GPT-OSS 20B' }
]

export function getDefaultModels(provider: string): ModelInfo[] {
  switch (provider) {
    case 'openai': return OPENAI_DEFAULTS
    case 'anthropic': return ANTHROPIC_DEFAULTS
    case 'google': return GOOGLE_DEFAULTS
    case 'ollama': return OLLAMA_DEFAULTS
    default: return []
  }
}

// ── API-based model fetching (supplements/replaces defaults when available) ──

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  if (!response.ok) throw new Error(`OpenAI API Fehler (${response.status})`)

  const data = (await response.json()) as { data: { id: string }[] }
  return data.data
    .filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o'))
    .filter((m) =>
      !m.id.includes('realtime') && !m.id.includes('audio') &&
      !m.id.includes('transcri') && !m.id.includes('tts') &&
      !m.id.includes('dall-e') && !m.id.includes('whisper') &&
      !m.id.includes('embedding') && !m.id.includes('moderation') &&
      !m.id.includes('search') && !m.id.includes('instruct')
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({ id: m.id, name: m.id }))
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
  })
  if (!response.ok) throw new Error(`Anthropic API Fehler (${response.status})`)

  const data = (await response.json()) as { data: { id: string; display_name: string }[] }
  return data.data
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({ id: m.id, name: m.display_name || m.id }))
}

async function fetchGeminiModels(settings: Record<string, string>): Promise<ModelInfo[]> {
  let accessToken = settings.googleAccessToken
  const refreshToken = settings.googleRefreshToken
  const expiresAt = parseInt(settings.googleTokenExpiry || '0', 10)

  if (!accessToken || !refreshToken) throw new Error('Nicht bei Google angemeldet.')

  if (Date.now() > expiresAt - 60_000) {
    const clientId = settings.googleClientId
    const clientSecret = settings.googleClientSecret
    if (!clientId || !clientSecret) throw new Error('Google Client-ID/Secret nicht konfiguriert.')
    const refreshed = await refreshGoogleToken(clientId, clientSecret, refreshToken)
    setSetting('googleAccessToken', refreshed.accessToken)
    setSetting('googleTokenExpiry', String(refreshed.expiresAt))
    accessToken = refreshed.accessToken
  }

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!response.ok) throw new Error(`Gemini API Fehler (${response.status})`)

  const data = (await response.json()) as {
    models: { name: string; displayName: string; supportedGenerationMethods: string[] }[]
  }
  return data.models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({ id: m.name.replace('models/', ''), name: m.displayName }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

async function fetchOllamaModels(baseUrl: string): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl}/api/tags`)
  if (!response.ok) throw new Error(`Ollama API Fehler (${response.status})`)

  const data = (await response.json()) as {
    models: { name: string; model: string }[]
  }
  return (data.models || [])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => ({ id: m.name, name: m.name }))
}

export async function listModelsFromApi(params: ListModelsParams): Promise<ModelInfo[]> {
  const provider = params.provider

  if (provider === 'openai') {
    if (!params.apiKey?.trim()) throw new Error('Kein API-Schlüssel.')
    return fetchOpenAIModels(params.apiKey)
  }
  if (provider === 'anthropic') {
    if (!params.apiKey?.trim()) throw new Error('Kein API-Schlüssel.')
    return fetchAnthropicModels(params.apiKey)
  }
  if (provider === 'google') {
    return fetchGeminiModels(getAllSettings())
  }
  if (provider === 'ollama') {
    const settings = getAllSettings()
    const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434'
    return fetchOllamaModels(ollamaUrl)
  }
  throw new Error(`Unbekannter Provider: ${provider}`)
}
