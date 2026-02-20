import { insertLog } from './db/errorLogDao'

/**
 * Regex patterns that may expose credentials.
 * Each entry: [pattern, safeReplacement]
 */
const SENSITIVE_PATTERNS: [RegExp, string][] = [
  // OpenAI / Anthropic API keys:  sk-..., sk-ant-api03-...
  [/\bsk-[a-zA-Z0-9\-_]{10,}/g, '[API-KEY]'],
  // Google OAuth access/refresh tokens:  ya29.xxx  or  1//xxx
  [/\bya29\.[a-zA-Z0-9._\-]+/g, '[GOOGLE-TOKEN]'],
  [/\b1\/\/[a-zA-Z0-9._\-]+/g, '[GOOGLE-TOKEN]'],
  // Authorization: Bearer <token>
  [/Authorization:\s*Bearer\s+\S+/gi, 'Authorization: Bearer [REDACTED]'],
  // x-api-key: <value>  (Anthropic header)
  [/x-api-key:\s*\S+/gi, 'x-api-key: [REDACTED]'],
  // "password": "...",  'password': '...'  (JSON / object literals)
  [/("pass(?:word)?"|'pass(?:word)?')\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi, '$1: "[REDACTED]"'],
  // pass=value  or  password=value  (URL / config strings)
  [/\bpass(?:word)?=\S+/gi, 'pass=[REDACTED]'],
  // ImapFlow auth object: auth: { user: '...', pass: '...' }
  [/\bpass\s*:\s*'[^']*'/g, "pass: '[REDACTED]'"],
  [/\bpass\s*:\s*"[^"]*"/g, 'pass: "[REDACTED]"'],
]

function sanitize(text: string): string {
  let result = text
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

export function logError(context: string, message: string, stack?: string): void {
  console.error(`[${context}] ${message}`)
  try {
    insertLog('error', context, sanitize(message), stack ? sanitize(stack) : undefined)
  } catch { /* ignore — DB may not be ready */ }
}

export function logWarn(context: string, message: string): void {
  console.warn(`[${context}] ${message}`)
  try {
    insertLog('warn', context, sanitize(message))
  } catch { /* ignore */ }
}
